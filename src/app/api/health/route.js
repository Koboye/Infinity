// Liveness probe for uptime monitors and deploy checks. Public, cheap, and leaks nothing but the version.
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let version = process.env.NEXT_PUBLIC_APP_VERSION || 'unknown';
export async function GET() {
  return NextResponse.json({ ok: true, version, time: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function HEAD() { return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } }); }
