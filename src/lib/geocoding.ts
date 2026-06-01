/**
 * Server-side geocoding.
 *
 * Turns a street address into { lat, lng } via the Google Geocoding API so
 * locations carry coordinates the mobile app can use for nearest-location
 * auto-assignment.
 *
 * Key resolution: prefer a dedicated server key (GOOGLE_GEOCODING_API_KEY) and
 * fall back to the public Maps key. The public NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * is typically HTTP-referer-restricted, so server-side calls with it may be
 * rejected — provision GOOGLE_GEOCODING_API_KEY (Geocoding API enabled, no
 * referer restriction) for reliable server use.
 */

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

function getGeocodingKey(): string | undefined {
  return (
    process.env.GOOGLE_GEOCODING_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    undefined
  );
}

/**
 * Geocode a free-form address. Returns null on any failure (no key, no result,
 * network/API error) — callers treat coordinates as optional.
 */
export async function geocodeAddress(
  address: string | undefined | null,
): Promise<GeoCoordinates | null> {
  const trimmed = address?.trim();
  if (!trimmed) return null;

  const key = getGeocodingKey();
  if (!key) {
    console.warn("[geocoding] No geocoding API key configured; skipping.");
    return null;
  }

  try {
    const url = `${GEOCODE_ENDPOINT}?address=${encodeURIComponent(
      trimmed,
    )}&key=${key}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(
        `[geocoding] HTTP ${response.status} geocoding "${trimmed}"`,
      );
      return null;
    }

    const data = await response.json();
    if (data.status !== "OK" || !data.results?.length) {
      console.warn(
        `[geocoding] status=${data.status} for "${trimmed}"`,
        data.error_message ?? "",
      );
      return null;
    }

    const location = data.results[0]?.geometry?.location;
    if (
      typeof location?.lat !== "number" ||
      typeof location?.lng !== "number"
    ) {
      return null;
    }

    return { lat: location.lat, lng: location.lng };
  } catch (error) {
    console.error(`[geocoding] Failed to geocode "${trimmed}":`, error);
    return null;
  }
}
