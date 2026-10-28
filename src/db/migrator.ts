import { Umzug, SequelizeStorage } from 'umzug';
import sequelize from '../config/database';
import { logger } from '../utils/logger';

export const migrator = new Umzug({
  migrations: {
    glob: ['migrations/*.{ts,js}', { cwd: __dirname }],
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'SequelizeMeta' }),
  logger: {
    info: (msg) => logger.info(`[migration] ${JSON.stringify(msg)}`),
    warn: (msg) => logger.warn(`[migration] ${JSON.stringify(msg)}`),
    error: (msg) => logger.error(`[migration] ${JSON.stringify(msg)}`),
    debug: (msg) => logger.debug(`[migration] ${JSON.stringify(msg)}`),
  },
});

export type Migration = typeof migrator._types.migration;

/**
 * Ejecuta todas las migraciones pendientes de forma segura e idempotente.
 */
export async function runMigrations(): Promise<void> {
  try {
    const pending = await migrator.pending();
    if (pending.length > 0) {
      logger.info(`[db] Ejecutando ${pending.length} migraciones pendientes...`);
      const executed = await migrator.up();
      logger.info(`[db] ${executed.length} migraciones aplicadas con éxito.`);
    } else {
      logger.info('[db] Esquema de base de datos al día (0 migraciones pendientes).');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[db] Error ejecutando migraciones: ${message}`);
    throw err;
  }
}

/**
 * Revierte la última migración aplicada.
 */
export async function rollbackMigration(): Promise<void> {
  try {
    const executed = await migrator.down();
    logger.info(`[db] ${executed.length} migración revertida con éxito.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[db] Error revirtiendo migración: ${message}`);
    throw err;
  }
}
