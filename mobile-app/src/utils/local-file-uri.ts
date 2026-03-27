export function normalizeLocalFilePath(path: string): string {
  let normalized = path.trim();

  while (normalized.startsWith('file:')) {
    normalized = normalized.replace(/^file:\/*/, '/');
  }

  while (normalized.startsWith('/file:')) {
    normalized = normalized.replace(/^\/file:\/*/, '/');
  }

  normalized = normalized.trim();
  if (!normalized) {
    return normalized;
  }

  return normalized.startsWith('/')
    ? normalized
    : `/${normalized.replace(/^\/+/, '')}`;
}

export function normalizeLocalFileUri(path: string): string {
  const normalizedPath = normalizeLocalFilePath(path);
  return normalizedPath ? `file://${normalizedPath}` : normalizedPath;
}
