/**
 * Output-path enforcement: deny absolute paths everywhere.
 * Reject any request payload that contains path-like keys — server always builds paths itself.
 */
const FORBIDDEN_KEYS = new Set([
  'outputPath',
  'output_path',
  'filePath',
  'file_path',
  'outputDir',
  'output_dir',
  'targetPath',
  'target_path',
  'savePath',
  'save_path',
  'destPath',
  'dest_path',
  'absolutePath',
  'absolute_path',
  'fullPath',
  'full_path',
  'directory',
]);

/**
 * Recursively collect forbidden path keys. Returns array of found keys (empty if none).
 */
function collectForbiddenKeys(obj: unknown, found: Set<string> = new Set()): string[] {
  if (obj === null || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectForbiddenKeys(item, found));
    return Array.from(found);
  }
  for (const [k, v] of Object.entries(obj)) {
    const key = k.trim();
    if (FORBIDDEN_KEYS.has(key)) found.add(key);
    collectForbiddenKeys(v, found);
  }
  return Array.from(found);
}

export class PathPayloadForbiddenError extends Error {
  forbiddenKeys: string[];
  constructor(keys: string[]) {
    super(`PATH_PAYLOAD_FORBIDDEN: keys [${keys.join(', ')}] not allowed (server builds paths)`);
    this.name = 'PathPayloadForbiddenError';
    this.forbiddenKeys = keys;
  }
}

/**
 * Reject request body if it contains any path-like keys. Throws PathPayloadForbiddenError with forbiddenKeys.
 */
export function rejectPathPayloads(body: unknown): void {
  const keys = collectForbiddenKeys(body);
  if (keys.length > 0) throw new PathPayloadForbiddenError(keys);
}

/** Check Content-Type is JSON. Returns 415 Response if not. */
export function requireJsonContentType(request: Request): Response | null {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.toLowerCase().startsWith('application/json')) {
    return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
      status: 415,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}
