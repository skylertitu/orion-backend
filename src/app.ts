import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import sequelize from './config/database';
import { cleanupOrphanTables } from './config/cleanupDatabase';
import { initFirebaseAdmin } from './config/firebase';
import './models';
import { ensureWalletColumns } from './models/Wallet';
import { ensureUserPlanColumn } from './models/User';
import { ensureIndicatorCategoryColumn } from './models/Indicator';
import routes from './routes';
import { swaggerSpec } from './config/swagger';
import { metatraderService } from './integrations/metatrader/mt.service';
import { tradingEngine } from './engine/TradingEngine';
import { BinanceAdapter } from './engine/adapters/BinanceAdapter';
import { BybitAdapter } from './engine/adapters/BybitAdapter';
import { MT5Adapter } from './engine/adapters/MT5Adapter';
import { TradingWorker } from './engine/TradingWorker';
import workerRoutes, { setWorkerInstance } from './routes/worker.routes';
import { logger } from './utils/logger';
import { ensureBootstrapAdmin } from './utils/roles';
import { ensureSystemControls, isModuleEnabled } from './services/systemControl.service';
import { ensureRiskSettings, isPausedByRiskSync } from './services/risk.service';
import { setupMarketWs } from './routes/marketWs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3008;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
  referrerPolicy: { policy: 'same-origin' },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    if (req.originalUrl.startsWith('/api/docs')) return;
    logger.warn(`[http] ${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
});
app.use(express.json({ limit: '400kb' }));
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ success: false, error: 'JSON inválido' });
  }
  return next(err);
});
if (process.env.NODE_ENV !== 'production') {
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, { swaggerOptions: { persistAuthorization: true } }),
  );
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));
}
app.use('/api', routes);
app.use('/api/worker', workerRoutes);

const workerCycleSeconds = parseInt(process.env.WORKER_CYCLE_SECONDS || '30', 10);
const tradingWorker = new TradingWorker(workerCycleSeconds);
setWorkerInstance(tradingWorker);

async function syncDatabase(): Promise<void> {
  const mode = (process.env.DB_SYNC || 'safe').toLowerCase();
  if (mode === 'false' || mode === 'off') {
    logger.info('[DB] Sync omitido (DB_SYNC=false)');
    return;
  }
  if (mode === 'alter') {
    logger.info('[DB] Sync con alter (puede tardar 20–60s en Neon)...');
    await sequelize.sync({ alter: true });
    return;
  }
  await sequelize.sync();
}

const start = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connected successfully');
    if (process.env.CLEANUP_ORPHAN_TABLES === 'true') {
      await cleanupOrphanTables();
    }
    await syncDatabase();
    await ensureWalletColumns();
    await ensureUserPlanColumn();
    await ensureIndicatorCategoryColumn();
    logger.info('Models synchronized');
    await ensureBootstrapAdmin();
    await ensureSystemControls();
    await ensureRiskSettings();
    await initFirebaseAdmin();

    tradingEngine.register(new BinanceAdapter());
    tradingEngine.register(new MT5Adapter());
    tradingEngine.register(new BybitAdapter());

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      setupMarketWs(server);

      const workerAllowed = process.env.WORKER_ENABLED !== 'false';
      void isModuleEnabled('worker').then((flagOn) => {
        if (workerAllowed && flagOn && !isPausedByRiskSync()) {
          tradingWorker.start();
        } else {
          logger.info('[TradingWorker] Deshabilitado por entorno, control de admin o pausa de riesgo');
        }
      });

      if (process.env.MT_ENABLED === 'true') {
        void metatraderService.connect();
      } else {
        logger.info('[MetaTrader] Deshabilitado (MT_ENABLED=false)');
      }
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`[Server] El puerto ${PORT} ya está en uso. Cierra el otro npm run dev y vuelve a intentar.`);
      } else {
        logger.error(`[Server] ${err.message}`);
      }
      process.exit(1);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Unable to connect to database: ${message}`);
    if (process.env.DATABASE_URL?.includes('neon.tech')) {
      logger.error(
        '[Database] Si Neon falla por red, verifica que el compute no esté suspendido en el dashboard de Neon.'
      );
    }
    process.exit(1);
  }
};

start();

export default app;
