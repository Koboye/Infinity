// One error type for the API route and the modules it calls, so a thrown failure always becomes the right HTTP status.
export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
export const fail = (status, msg) => { throw new HttpError(status, msg); };
