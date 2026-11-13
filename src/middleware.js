// Hill Climb is a static page, so Next would serve it to anyone. With the paywall on, only a browser holding a valid ticket
// (see /api/hillclimb) gets the page; everyone else goes back to the home screen. Each level start is still checked by the server.
import { NextResponse } from 'next/server';
import { TICKET_COOKIE, verifyTicket, ticketSecret } from '@/lib/hcTicket.js';

export const config = { matcher: ['/games/hillclimb-racing', '/games/hillclimb-racing/', '/games/hillclimb-racing/index.html'] };

export async function middleware(req) {
  const on = process.env.PAYWALL === '1' || process.env.PAYWALL === 'true';
  if (!on) return NextResponse.next();
  if (await verifyTicket(req.cookies.get(TICKET_COOKIE)?.value, ticketSecret())) return NextResponse.next();
  const url = req.nextUrl.clone(); url.pathname = '/'; url.search = '?play=hillclimb';
  return NextResponse.redirect(url);
}
