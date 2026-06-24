/**
 * Firestore ⇄ domain converters.
 * Keeps SDK types (Timestamp, FieldValue) from leaking into the UI layer.
 */

import {
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { ISODateString } from '@/types';

const toISO = (value: unknown): ISODateString => {
  if (!value) return new Date().toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

/** Generic snapshot → typed model converter. */
export function snapshotTo<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    // Auto-convert any field ending in `At` if it's a Timestamp
    ...stripTimestamps(data),
  } as T;
}

/**
 * Firestore data comes back with Timestamp fields. We rewrite every field
 * named `*At` from a Timestamp to ISO string. For deeper graphs, extend
 * this with explicit converters per-collection (see videoConverter etc.).
 */
function stripTimestamps(data: DocumentData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.endsWith('At') && value instanceof Timestamp) {
      out[key] = value.toDate().toISOString();
    } else if (value instanceof Timestamp) {
      out[key] = value.toDate().toISOString();
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Build an ISO date `n` seconds in the future. */
export function futureISO(seconds: number): ISODateString {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/** Build an ISO date `n` days ago. Useful for trend-window queries. */
export function pastISODays(days: number): ISODateString {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export { toISO, Timestamp };
