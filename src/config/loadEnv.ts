import dotenv from 'dotenv';

dotenv.config();

function isBlank(name: string): boolean {
  return !process.env[name]?.trim();
}

function assertRequiredEnv(): void {
  const required = ['JWT_SECRET'];
  if (process.env.NODE_ENV === 'production') {
    required.push('DATABASE_URL', 'ENCRYPTION_KEY');
  }
  const missing = required.filter(isBlank);
  if (missing.length === 0) return;
  throw new Error(
    `Faltan variables de entorno: ${missing.join(', ')}. ` +
      'En Render agrégalas en orion-backend → Environment (no en el servicio Postgres). ' +
      'JWT_SECRET y ENCRYPTION_KEY: botón Generate. ' +
      'DATABASE_URL: Internal Database URL de tu PostgreSQL de Render.'
  );
}

assertRequiredEnv();
