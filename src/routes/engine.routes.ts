import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModule } from '../middlewares/module.middleware';
import { requireCapability } from '../middlewares/plan.middleware';
import { tradingLimiter } from '../middlewares/rateLimiter';
import {
  getBrokers,
  executeOrder,
  getPositions,
  closePosition,
  getPrice,
} from '../controllers/engine.controller';

const router = Router();

router.get('/brokers', getBrokers);
router.get('/price', getPrice);
router.post(
  '/order',
  authMiddleware,
  requireModule('trading'),
  requireCapability('manual_orders'),
  tradingLimiter,
  executeOrder
);
router.get(
  '/positions',
  authMiddleware,
  requireModule('trading'),
  requireCapability('manual_orders'),
  getPositions
);
router.delete(
  '/positions/:broker/:ticket',
  authMiddleware,
  requireModule('trading'),
  requireCapability('manual_orders'),
  closePosition
);

export default router;
