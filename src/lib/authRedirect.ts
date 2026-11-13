/**
 * Only a same-site path is accepted as the place to return to after signing in,
 * so a crafted link can never send a learner to another site.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}

/** The sign-in URL that brings the learner back to `pathname` + `search` afterwards. */
export function authPathFor(pathname: string, search = ''): string {
  const target = `${pathname}${search}`;
  if (!target || target === '/' || target === '/auth' || target.startsWith('/auth?')) return '/auth';
  return `/auth?next=${encodeURIComponent(target)}`;
}
