import { NextResponse } from 'next/server';
export const fail = (e) => {
  console.error('dimts route error:', e);
  return NextResponse.json({ error: e.message || 'Internal error' }, { status: e.status || 500 });
};
