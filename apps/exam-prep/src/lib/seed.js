import { SEED } from '@/data/seedQuestions.js';
import IMPORTED from '@/data/imported.json' with { type: 'json' };
import { isDept } from '@/data/departments.js';

/** The built-in sample questions of a department, in the shape the app uses everywhere. */
export const seedFor = (dept) => (isDept(dept) ? [...(SEED[dept] || []), ...(IMPORTED[dept] || [])].map((x, i) => ({ id: `${dept}-s${i + 1}`, dept, text: x.t, options: x.o, answer: x.a, explanation: x.e, topic: x.topic || '', source: 'seed' })) : []);
export const seedCounts = () => Object.fromEntries([...new Set([...Object.keys(SEED), ...Object.keys(IMPORTED)])].map((d) => [d, (SEED[d] || []).length + (IMPORTED[d] || []).length]));
