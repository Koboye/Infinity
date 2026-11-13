import { SEED } from '@/data/seedQuestions.js';
import { isDept } from '@/data/departments.js';

/** The built-in sample questions of a department, in the shape the app uses everywhere. */
export const seedFor = (dept) => (isDept(dept) ? (SEED[dept] || []).map((x, i) => ({ id: `${dept}-s${i + 1}`, dept, text: x.t, options: x.o, answer: x.a, explanation: x.e, topic: x.topic || '', source: 'seed' })) : []);
export const seedCounts = () => Object.fromEntries(Object.keys(SEED).map((d) => [d, SEED[d].length]));
