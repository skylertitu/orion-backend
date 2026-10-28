import '../config/loadEnv';
import sequelize from '../config/database';
import { runMigrations, rollbackMigration } from './migrator';
import { logger } from '../utils/logger';

async function main() {
  const action = process.argv[2] || 'up';
  try {
    await sequelize.authenticate();
    logger.info('[db:cli] Conexión establecida con la base de datos.');

    if (action === 'down' || action === 'undo') {
      await rollbackMigration();
    } else {
      await runMigrations();
    }
  } catch (err) {
    logger.error(`[db:cli] Falló la ejecución: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

void main();
