import dns from 'node:dns/promises';
import net from 'node:net';

// Port of dubber/safety.py — a pasted link must never reach private networks (SSRF).
const ALLOWED = new Set(['http:', 'https:', 'rtmp:', 'rtmps:', 'rtsp:']);

function isPrivate(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
}

export async function validateLink(link) {
  let u;
  try { u = new URL(String(link || '').trim()); } catch { u = null; }
  if (!u || !ALLOWED.has(u.protocol) || !u.hostname) {
    const e = new Error('That does not look like a web link. Paste a YouTube, stream or video link that starts with https://');
    e.status = 400; throw e;
  }
  try {
    const addrs = net.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error('private');
  } catch (err) {
    const e = new Error(err.message === 'private' ? 'Links to private or local addresses are not allowed.' : 'Could not find that website. Check the link.');
    e.status = 400; throw e;
  }
  return u.toString();
}
