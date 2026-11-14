import assert from 'node:assert/strict';
import { cleanLevel, LEVELS } from '../src/lib/learnerLevel.js';
const t = (n, f) => { try { f(); console.log('ok', n); } catch (e) { console.error('FAIL', n, e.message); process.exitCode = 1; } };
t('covers KG1-3, grades 1-12, uni, ngat', () => assert.equal(LEVELS.length, 17));
t('accepts a grade', () => assert.deepEqual(cleanLevel({ grade: 'g7', dept: 'x' }), { grade: 'g7', dept: '' }));
t('university needs a department', () => assert.ok(cleanLevel({ grade: 'uni' }).error));
t('university keeps a valid department', () => assert.deepEqual(cleanLevel({ grade: 'uni', dept: 'computer-science' }), { grade: 'uni', dept: 'computer-science' }));
t('rejects unknown or old levels', () => { assert.ok(cleanLevel({ grade: 'gk' }).error); assert.ok(cleanLevel({ grade: 'kg' }).error); assert.ok(cleanLevel(null).error); });
