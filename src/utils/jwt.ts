import jwt, { SignOptions } from 'jsonwebtoken';

const SECRET: string = process.env.JWT_SECRET || (() => {
  throw new Error('JWT_SECRET no está configurado en el archivo .env');
})();

export interface TokenPayload {
  id: number;
  email: string;
  username: string;
  role: string;
}

export function signToken(payload: TokenPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload, SECRET, { expiresIn: expiresIn as SignOptions['expiresIn'] });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
