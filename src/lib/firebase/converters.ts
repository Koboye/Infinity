import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';

export function snapshotTo<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  const data = snap.data();
  const converted: Record<string, unknown> = { id: snap.id };
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) converted[key] = value.toDate().toISOString();
    else converted[key] = value;
  }
  return converted as T;
}
