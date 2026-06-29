// src/lib/firebase/server-auth.ts - SERVER-SIDE ONLY
import { adminAuth } from './admin';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function requireUser(request: Request): Promise<{ uid: string }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new AuthError('Missing token');
  }

  try {
    const decodedToken = await adminAuth().verifyIdToken(token);
    return { uid: decodedToken.uid };
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new AuthError('Invalid or expired token');
  }
}
