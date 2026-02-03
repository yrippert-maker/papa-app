/** Обрезка и санитизация строк для безопасного логирования (защита от log injection и раздувания). */
export function sanitizeForLog(value: string, maxLen = 200): string {
  const truncated = value.length > maxLen ? value.slice(0, maxLen) + '…' : value;
  return truncated.replace(/[\x00-\x1f\x7f]/g, '?');
}
