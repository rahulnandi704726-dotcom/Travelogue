import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { findUserByEmail, getOrCreateUser } from '../db/repository.ts';

export interface AuthUser {
  id: number;
  uid: string;
  email: string;
  role: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

const getSessionSecret = () =>
  process.env.AUTH_SECRET || 'travelworld-cloudsql-session-secret-2026';

export function signSessionToken(user: AuthUser): string {
  const payload = {
    id: user.id,
    uid: user.uid,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `tw.${encoded}.${sig}`;
}

export function verifySessionToken(token: string): AuthUser | null {
  try {
    if (!token.startsWith('tw.')) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [, encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encoded)
      .digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return {
      id: payload.id,
      uid: payload.uid,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

async function resolveUserFromToken(token: string): Promise<AuthUser | null> {
  // 1. Check signed local session token
  const localUser = verifySessionToken(token);
  if (localUser) {
    return localUser;
  }

  // 2. Fallback to Firebase Admin ID Token verification
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || `${decoded.uid}@firebase.local`).toLowerCase();
    const dbUser = await getOrCreateUser(
      decoded.uid,
      email,
      decoded.name || email.split('@')[0]
    );
    return {
      id: dbUser.id,
      uid: dbUser.uid,
      email: dbUser.email,
      role: dbUser.role,
      name: dbUser.name,
    };
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('tw_session='));
    if (match) {
      return decodeURIComponent(match.slice('tw_session='.length));
    }
  }
  return null;
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const token = extractBearerToken(req);
  if (token) {
    const user = await resolveUserFromToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }
  const user = await resolveUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }
  // Confirm user exists in database for local tokens
  if (token.startsWith('tw.')) {
    const dbUser = await findUserByEmail(user.email);
    if (!dbUser) {
      return res.status(401).json({ error: 'Unauthorized: Account not found.' });
    }
    req.user = {
      id: dbUser.id,
      uid: dbUser.uid,
      email: dbUser.email,
      role: dbUser.role,
      name: dbUser.name,
    };
  } else {
    req.user = user;
  }
  next();
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Admin sign-in required.' });
  }
  if (
    req.user.role !== 'admin' &&
    req.user.email.toLowerCase() !== 'rahulnandi7047@gmail.com'
  ) {
    return res.status(403).json({ error: 'Forbidden: Administrator access required.' });
  }
  next();
};
