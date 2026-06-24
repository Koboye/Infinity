/**
 * Centralised feature flag reader.
 * Lets us kill switches quickly without redeploying the entire bundle.
 */
export const FEATURES = {
  aiModeration: process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'false',
  liveStreams: process.env.NEXT_PUBLIC_ENABLE_LIVE_STREAMS !== 'false',
  marketplace: process.env.NEXT_PUBLIC_ENABLE_MARKETPLACE !== 'false',
} as const;

/** Tagged-template marker — keeps the import tree-shake friendly. */
export const FUTURE_FEATURE = 'reserved';
