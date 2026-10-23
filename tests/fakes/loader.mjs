import { pathToFileURL } from 'node:url';
const src = new URL('../../src/', import.meta.url).pathname;
export async function resolve(spec, ctx, next) {
  if (spec === 'next/server') return { url: pathToFileURL(new URL('./next-server.mjs', import.meta.url).pathname).href, shortCircuit: true };
  if (spec === 'firebase-admin/firestore') return { url: pathToFileURL(new URL('./admin-firestore.mjs', import.meta.url).pathname).href, shortCircuit: true };
  if (spec === '@/lib/firebaseAdmin') return { url: pathToFileURL(new URL('./firebaseAdmin.mjs', import.meta.url).pathname).href, shortCircuit: true };
  if (spec.startsWith('@/')) return next(pathToFileURL(src + spec.slice(2) + (/\.\w+$/.test(spec) ? '' : '.js')).href, ctx);
  return next(spec, ctx);
}
