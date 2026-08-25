import { Sequelize, Options } from 'sequelize';
import './loadEnv';

const dbUri = process.env.DATABASE_URL?.trim();
const dbName = process.env.DB_NAME || 'orion';
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);

function hostnameFromUri(uri?: string): string | null {
  if (!uri) return null;
  try {
    return new URL(uri).hostname;
  } catch {
    return null;
  }
}

const uriHost = hostnameFromUri(dbUri);
const effectiveHost = uriHost || dbHost;
const isNeon = Boolean(dbUri?.includes('neon.tech'));
const isRender = Boolean(dbUri?.includes('render.com') || effectiveHost.startsWith('dpg-'));
const isLocalHost = ['localhost', '127.0.0.1'].includes(effectiveHost);
const useSsl =
  process.env.DB_SSL === 'true' ||
  isNeon ||
  isRender ||
  (!isLocalHost && Boolean(dbUri));

function buildDialectOptions(): Options['dialectOptions'] {
  if (!useSsl) return {};
  return {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  };
}

function buildSequelize(): Sequelize {
  const commonOptions: Options = {
    dialect: 'postgres',
    logging: false,
    dialectOptions: buildDialectOptions(),
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  };

  if (isNeon && dbUri) {
    // Neon via WebSocket/HTTP: evita ECONNRESET del puerto TCP 5432 en algunas redes.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ws = require('ws');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neonConfig } = require('@neondatabase/serverless');
    neonConfig.webSocketConstructor = ws;

    return new Sequelize(dbUri, {
      ...commonOptions,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      dialectModule: require('@neondatabase/serverless'),
    });
  }

  if (dbUri) {
    return new Sequelize(dbUri, commonOptions);
  }

  return new Sequelize(dbName, dbUser, dbPassword, {
    host: dbHost,
    port: dbPort,
    ...commonOptions,
  });
}

const sequelize = buildSequelize();

export default sequelize;
