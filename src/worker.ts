import './config/loadEnv';
import sequelize from './config/database';
import { workerLogger } from './utils/logger';
import { TradingWorker } from './engine/TradingWorker';
import { tradingEngine } from './engine/TradingEngine';
import { BinanceAdapter } from './engine/adapters/BinanceAdapter';
import { MT5Adapter } from './engine/adapters/MT5Adapter';
import { BybitAdapter } from './engine/adapters/BybitAdapter';
import { metatraderService } from './integrations/metatrader/mt.service';
import { isModuleEnabled } from './services/systemControl.service';
import { isPausedByRiskSync } from './services/risk.service';
import { runMigrations } from './db/migrator';
import './models';

async function bootstrapWorker() {
  workerLogger.info('=============================================');
  workerLogger.info('Iniciando Proceso Autónomo de Trading Worker');
  workerLogger.info('=============================================');

  try {
    await sequelize.authenticate();
    workerLogger.info('[Worker] Conexión establecida con la base de datos.');

    // Asegurar migraciones al arrancar
    await runMigrations();

    // Registrar adaptadores de broker
    tradingEngine.register(new BinanceAdapter());
    tradingEngine.register(new MT5Adapter());
    tradingEngine.register(new BybitAdapter());

    if (process.env.MT_ENABLED === 'true') {
      void metatraderService.connect();
    } else {
      workerLogger.info('[MetaTrader] Deshabilitado (MT_ENABLED=false)');
    }

    const cycleSeconds = parseInt(process.env.WORKER_CYCLE_SECONDS || '30', 10);
    const worker = new TradingWorker(cycleSeconds);

    const workerAllowed = process.env.WORKER_ENABLED !== 'false';
    const flagOn = await isModuleEnabled('worker');

    if (workerAllowed && flagOn && !isPausedByRiskSync()) {
      worker.start();
      workerLogger.info('[Worker] Bucle de trading activo.');
    } else {
      workerLogger.warn(
        '[Worker] En espera (deshabilitado en variables de entorno, control de administración o pausado por riesgo).'
      );
    }

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      workerLogger.info(`[Worker] Recibida señal ${signal}. Deteniendo bucle de trading...`);
      worker.stop();
      try {
        await sequelize.close();
      } catch {
        // ignore
      }
      workerLogger.info('[Worker] Proceso finalizado limpiamente.');
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    workerLogger.error(`[Worker] Error crítico iniciando el proceso: ${message}`);
    process.exit(1);
  }
}

void bootstrapWorker();
