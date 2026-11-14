// A student's learning level lives on their account (Firestore learners/{uid}), written only by the server.
// The level is set once; it is never changed from the app, so a student only ever sees material for their own level.
export const LEVELS = ['kg1', 'kg2', 'kg3', ...Array.from({ length: 12 }, (_, i) => 'g' + (i + 1)), 'uni', 'ngat'];

export function cleanLevel(body) {
  const grade = typeof body?.grade === 'string' ? body.grade : '';
  if (!LEVELS.includes(grade)) return { error: 'Choose a valid level.' };
  const dept = grade === 'uni' ? String(body?.dept || '').slice(0, 80) : '';
  if (grade === 'uni' && !/^[a-z0-9-]{2,80}$/.test(dept)) return { error: 'Choose your department.' };
  return { grade, dept };
}
