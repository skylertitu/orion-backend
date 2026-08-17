import sequelize from './database';
import { logger } from '../utils/logger';

/** Tablas que ya no usa Orion — se eliminan al arrancar si existen */
const ORPHAN_TABLES = [
  'broker_connection_logs',
  'broker_credentials',
  'schema_migrations',
  'broker_configs',
  'audit_logs',
  'auth_sessions',
  'integration_tokens',
  'merchant_profiles',
  'strategy_indicators',
  'transactions',
  'portfolios',
];

export async function cleanupOrphanTables(): Promise<void> {
  for (const table of ORPHAN_TABLES) {
    try {
      await sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    } catch (err: any) {
      logger.warn(`[DB] No se pudo eliminar tabla ${table}: ${err.message}`);
    }
  }
  logger.info(`[DB] Limpieza de tablas obsoletas completada (${ORPHAN_TABLES.length} revisadas)`);
}
