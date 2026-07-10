/**
 * Pure formatting / data-transform helpers extracted from Infinity.jsx.
 * No Firebase, no browser-only APIs beyond what's passed in — safe to import
 * anywhere, including server code, without pulling in the Firebase client SDK.
 */

// Normalizes a createdAt value (Firestore Timestamp, plain number, or Date) to millis,
// then sorts newest-first. Used everywhere the videos collection is fetched so post
// order is consistent regardless of which timestamp shape a given doc has.
export const tsToMillis = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
};

export const sortByNewest = (list) => list.slice().sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));

// Same normalization but returns a Date (or null), for display helpers like timeAgo().
export const tsToDate = (ts) => {
  const ms = tsToMillis(ts);
  return ms ? new Date(ms) : null;
};

// WhatsApp-style: show phone number only if the user opted in via Privacy settings; default to @username
// Uses publicPhone (the opt-in mirror field) rather than the private phone field, since
// `user` here may be another person's public profile doc, which never contains raw `phone`.
export const getDisplayHandle = (user) => {
  if (user?.privacy?.['Show Phone Number on Profile'] && user?.publicPhone) return user.publicPhone;
  return `@${user?.username || 'user'}`;
};

export const formatNumber = (num) => {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
};

// Guards against javascript:/data:/vbscript: URIs in user-supplied profile links (EditProfileModal's
// "Website / Link" field is free text, so without this a stored `javascript:...` value would run
// arbitrary script for anyone who taps the link on that profile). Only allow http(s); bare domains
// like "example.com" are treated as https since that's what people actually type.
export const safeProfileUrl = (raw) => {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch { return null; }
};

export const timeAgo = (date) => {
  if (!date) return 'now';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
};

// Deterministic id for a 1:1 call/session between two users, order-independent.
export const groupCallPairId = (a, b) => [a, b].sort().join('_');

export const pushTitleForType = (type) => ({
  message: 'New message',
  follow: 'New follower',
  like: 'New like',
  comment: 'New comment',
  mention: 'You were mentioned',
  gift: 'You got a gift',
  live: 'Live now',
  call: 'Incoming call',
  moderation: 'Infinity',
  friend_request: 'New friend request',
  friend_accept: 'Friend request accepted',
}[type] || 'Infinity');

// Shapes uploaded media URLs (from Cloudinary) into the fields a post/video doc expects.
export const buildMediaFields = (mediaItems, uploadedUrls) => {
  if (!uploadedUrls.length) return { mediaType: 'text' };
  const videoIdx = mediaItems.findIndex(m => (m.type || '').startsWith('video'));
  if (videoIdx !== -1) {
    const videoUrl = uploadedUrls[videoIdx];
    const images = uploadedUrls.filter((_, i) => i !== videoIdx);
    return { videoUrl, images, mediaType: mediaItems[videoIdx].type || 'video/mp4' };
  }
  if (uploadedUrls.length > 1) {
    return { videoUrl: uploadedUrls[0], images: uploadedUrls, mediaType: 'image/multi' };
  }
  return { videoUrl: uploadedUrls[0], images: uploadedUrls, mediaType: mediaItems[0].type || 'image/jpeg' };
};
