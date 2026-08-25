import jwt, { SignOptions } from 'jsonwebtoken';

const SECRET: string = process.env.JWT_SECRET || (() => {
  throw new Error('JWT_SECRET no está configurado en el archivo .env');
})();

export interface TokenPayload {
  id: number;
  email: string;
  username: string;
  role: string;
  plan?: string | null;
  sv?: number;
  purpose?: string;
}

export function signToken(payload: TokenPayload, expiresIn: string = '8h'): string {
  return jwt.sign(payload, SECRET, {
    expiresIn: expiresIn as SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function signEmailVerifyToken(userId: number, email: string): string {
  return jwt.sign(
    { id: userId, email, purpose: 'email-verify' },
    SECRET,
    { expiresIn: '24h', algorithm: 'HS256' }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] }) as TokenPayload;
    if (payload.purpose) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyEmailVerifyToken(token: string): { id: number; email: string } | null {
  try {
    const payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] }) as TokenPayload;
    if (payload.purpose !== 'email-verify' || !payload.id || !payload.email) return null;
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
}
