// Usernames: unique, lowercase, 3-20 characters (a-z, 0-9, dot, underscore). Shared by the sign-up form, the server and the tests.
export const USERNAME_MIN = 3, USERNAME_MAX = 20;
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,18})[a-z0-9]$/;
const RESERVED = new Set(['admin', 'administrator', 'support', 'afro', 'afrozone', 'infinity', 'moderator', 'system', 'root', 'official', 'staff', 'help', 'null', 'undefined']);

export const normalizeUsername = (s) => String(s ?? '').trim().replace(/^@/, '').toLowerCase();

/** null when fine, otherwise a short key the screen can translate. */
export function usernameProblem(raw) {
  const u = normalizeUsername(raw);
  if (u.length < USERNAME_MIN) return 'short';
  if (u.length > USERNAME_MAX) return 'long';
  if (!USERNAME_RE.test(u) || /[._]{2}/.test(u)) return 'chars';
  if (RESERVED.has(u)) return 'reserved';
  return null;
}
export const USERNAME_TEXT = {
  short: `Username needs at least ${USERNAME_MIN} characters.`,
  long: `Username can be at most ${USERNAME_MAX} characters.`,
  chars: 'Use letters, numbers, dots and underscores only (no spaces, and not starting or ending with a dot or underscore).',
  reserved: 'That username is reserved.',
  taken: 'That username is already taken.',
};
