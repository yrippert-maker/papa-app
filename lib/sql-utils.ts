/**
 * SQL utility functions for safe query construction.
 */

/**
 * Escapes LIKE wildcard characters (%, _, \) to prevent wildcard injection.
 * Use with ESCAPE '\' clause: WHERE col LIKE ? ESCAPE '\'
 */
export function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, (c) => '\\' + c);
}
