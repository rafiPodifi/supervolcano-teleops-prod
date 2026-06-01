/**
 * Server-side MP4 duration probe.
 *
 * Reads the encoded length of an MP4 already uploaded to Firebase Storage
 * without downloading the whole file. The mobile encoder reports no duration,
 * so this is how a media doc gets its real `durationSeconds` for per-cleaner
 * recording-hours tracking.
 *
 * Strategy: MP4 is a tree of boxes (`[uint32 size][4-char type][payload]`). We
 * walk only the top-level boxes via HTTP Range requests — Firebase download
 * URLs honor `Range` — hopping box-to-box by size until we hit `moov` (which
 * may sit at the head with faststart, or after a large `mdat` otherwise). Then
 * we read `moov`'s `mvhd` child for `duration / timescale`. Typically 2–3 tiny
 * range reads. Returns null on any failure; callers treat duration as optional.
 */

// Don't buffer an absurdly large moov into memory.
const MAX_MOOV_BYTES = 16 * 1024 * 1024;
// If a server ignores Range and returns the whole file, only buffer it when
// it's small enough to be safe.
const MAX_FULL_BODY_BYTES = 8 * 1024 * 1024;
// Cap how many boxes we hop before giving up (guards against malformed files).
const MAX_BOXES = 64;

interface RangeResult {
  buf: Buffer;
  /** Total file size if the server reported it (Content-Range), else null. */
  totalSize: number | null;
  /** True when the server honored Range (206), false when it sent 200. */
  partial: boolean;
}

async function fetchRange(
  url: string,
  start: number,
  end: number,
): Promise<RangeResult | null> {
  const res = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
  });

  if (res.status !== 206 && res.status !== 200) return null;

  const partial = res.status === 206;
  if (!partial) {
    // Range ignored — whole body incoming. Only buffer when small.
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_FULL_BODY_BYTES) return null;
  }

  let totalSize: number | null = null;
  const contentRange = res.headers.get("content-range"); // "bytes 0-15/12345"
  if (contentRange) {
    const slash = contentRange.lastIndexOf("/");
    const total = Number(contentRange.slice(slash + 1));
    if (Number.isFinite(total) && total > 0) totalSize = total;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, totalSize, partial };
}

interface BoxHeader {
  size: number; // total box size including header
  type: string;
  headerSize: number;
}

/** Parse a box header at `offset`. Returns null if the buffer is too short. */
function readBoxHeader(buf: Buffer, offset: number): BoxHeader | null {
  if (offset + 8 > buf.length) return null;
  const size32 = buf.readUInt32BE(offset);
  const type = buf.toString("latin1", offset + 4, offset + 8);

  if (size32 === 1) {
    if (offset + 16 > buf.length) return null;
    const large = buf.readBigUInt64BE(offset + 8);
    return { size: Number(large), type, headerSize: 16 };
  }
  // size32 === 0 means "extends to end of file" — caller resolves against total.
  return { size: size32, type, headerSize: 8 };
}

/** Find the `mvhd` child inside a fully-buffered `moov` box and return seconds. */
function durationFromMoov(moov: Buffer): number | null {
  // moov payload starts after its own 8-byte header.
  let pos = 8;
  for (let i = 0; i < MAX_BOXES && pos + 8 <= moov.length; i++) {
    const header = readBoxHeader(moov, pos);
    if (!header || header.size < 8) return null;

    if (header.type === "mvhd") {
      const c = pos + header.headerSize; // mvhd content start
      if (c + 1 > moov.length) return null;
      const version = moov.readUInt8(c);

      let timescale: number;
      let duration: number;
      if (version === 1) {
        // version(1) flags(3) creation(8) modification(8) timescale(4) duration(8)
        if (c + 32 > moov.length) return null;
        timescale = moov.readUInt32BE(c + 20);
        duration = Number(moov.readBigUInt64BE(c + 24));
      } else {
        // version(1) flags(3) creation(4) modification(4) timescale(4) duration(4)
        if (c + 20 > moov.length) return null;
        timescale = moov.readUInt32BE(c + 12);
        duration = moov.readUInt32BE(c + 16);
      }

      if (!timescale || timescale <= 0) return null;
      const seconds = duration / timescale;
      return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
    }

    pos += header.size;
  }
  return null;
}

/**
 * Probe the encoded duration (seconds) of an MP4 at `storageUrl`.
 * Returns null on any error so callers can fall back gracefully.
 */
export async function probeMp4DurationSeconds(
  storageUrl: string,
): Promise<number | null> {
  try {
    let pos = 0;
    let totalSize: number | null = null;

    for (let i = 0; i < MAX_BOXES; i++) {
      if (totalSize !== null && pos + 8 > totalSize) break;

      // Read just the box header (16 bytes covers the 64-bit-size form).
      const head = await fetchRange(storageUrl, pos, pos + 15);
      if (!head) return null;
      if (totalSize === null) totalSize = head.totalSize;

      // If Range was ignored we already hold (a prefix of) the whole file.
      if (!head.partial) {
        return scanWholeBuffer(head.buf);
      }

      const header = readBoxHeader(head.buf, 0);
      if (!header) return null;

      // size 0 → box runs to EOF; only resolvable for moov with a known total.
      const boxSize =
        header.size === 0 && totalSize !== null ? totalSize - pos : header.size;
      if (boxSize < 8) return null;

      if (header.type === "moov") {
        if (boxSize > MAX_MOOV_BYTES) return null;
        const moovRes = await fetchRange(storageUrl, pos, pos + boxSize - 1);
        if (!moovRes) return null;
        return durationFromMoov(moovRes.buf);
      }

      pos += boxSize;
    }
    return null;
  } catch (error) {
    console.warn("[mp4-duration] probe failed:", error);
    return null;
  }
}

/** Fallback path: a full (small) buffer was returned; walk it in memory. */
function scanWholeBuffer(buf: Buffer): number | null {
  let pos = 0;
  for (let i = 0; i < MAX_BOXES && pos + 8 <= buf.length; i++) {
    const header = readBoxHeader(buf, pos);
    if (!header || header.size < 8) return null;
    if (header.type === "moov") {
      return durationFromMoov(buf.subarray(pos, pos + header.size));
    }
    pos += header.size;
  }
  return null;
}
