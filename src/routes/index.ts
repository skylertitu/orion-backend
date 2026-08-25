import { Router } from 'express';
import sequelize from '../config/database';
import { isFirebaseAdminReady, isFirebaseAuthReady } from '../config/firebase';
import { LUCY_INTEGRATION } from '../integrations/lucy/lucy.pending';
import { metatraderService } from '../integrations/metatrader/mt.service';
import authRoutes from './auth.routes';
import strategyRoutes from './strategy.routes';
import lucyRoutes from './lucy.routes';
import metatraderRoutes from './metatrader.routes';
import engineRoutes from './engine.routes';
import adminRoutes from './admin.routes';
import superadminRoutes from './superadmin.routes';
import brokerAccountRoutes from './brokerAccount.routes';
import signalRoutes from './signal.routes';
import walletRoutes from './wallet.routes';
import marketRoutes from './market.routes';
import indicatorRoutes from './indicator.routes';
import jupiterRoutes from './jupiter.routes';
import { getSystemOverview } from '../controllers/system.controller';

const router = Router();

router.get('/health', async (_req, res) => {
  let database = false;
  try {
    await sequelize.authenticate();
    database = true;
  } catch {
    database = false;
  }

  res.json({
    success: true,
    data: {
      database,
      firebaseAdmin: isFirebaseAdminReady(),
      firebaseAuth: isFirebaseAuthReady(),
      metatrader: {
        enabled: process.env.MT_ENABLED === 'true',
        connected: metatraderService.isConnected(),
      },
      lucy: {
        pending: LUCY_INTEGRATION.pending,
        enabled: LUCY_INTEGRATION.enabled,
        reason: LUCY_INTEGRATION.reason,
      },
    },
  });
});

router.use('/auth', authRoutes);
router.use('/market', marketRoutes);
router.use('/strategies', strategyRoutes);
router.use('/lucy', lucyRoutes);
router.use('/mt', metatraderRoutes);
router.use('/engine', engineRoutes);
router.use('/admin', adminRoutes);
router.use('/superadmin', superadminRoutes);
router.use('/broker-accounts', brokerAccountRoutes);
router.use('/signals', signalRoutes);
router.use('/wallets', walletRoutes);
router.use('/indicators', indicatorRoutes);
router.use('/jupiter', jupiterRoutes);
router.get('/system/status', getSystemOverview);

export default router;
