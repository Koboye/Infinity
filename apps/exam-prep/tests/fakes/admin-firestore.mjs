export const FieldValue = {
  serverTimestamp: () => ({ __ts: true }),
  increment: (n) => ({ __inc: n }),
};
