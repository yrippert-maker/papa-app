/** Признак использования credentials по умолчанию (admin/admin). */
export function isCredentialsDefault(): boolean {
  return !process.env.AUTH_USER?.trim();
}
