/** Hours after which cinema, poetry, and gallery posts are purged from the app and storage. */
export const CONTENT_TTL_HOURS = 100;

export function contentExpiryCutoffIso(): string {
  return new Date(Date.now() - CONTENT_TTL_HOURS * 60 * 60 * 1000).toISOString();
}
