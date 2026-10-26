// Minimal NextResponse: NextResponse.json(body, init) and new NextResponse(text, init) (used for CSV downloads).
export class NextResponse {
  constructor(text, init = {}) { this.status = init.status || 200; this._text = text; this._h = new Map(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])); this.headers = { get: (k) => this._h.get(String(k).toLowerCase()) ?? null }; }
  async text() { return this._text; }
  static json(body, init = {}) { return { status: init.status || 200, body }; }
}
