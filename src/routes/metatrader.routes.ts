import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModule } from '../middlewares/module.middleware';
import { requireCapability } from '../middlewares/plan.middleware';
import {
  getMtStatus,
  getMtSymbols,
  getMtPositions,
  executeMtOrder,
  closeMtPosition,
  closeAllMtPositions,
} from '../controllers/metatrader.controller';
import { tradingLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.use(authMiddleware, requireModule('trading'), requireCapability('manual_orders'));

router.get('/status', getMtStatus);
router.get('/symbols', getMtSymbols);
router.get('/positions', getMtPositions);
router.post('/order', tradingLimiter, executeMtOrder);
router.delete('/positions/:ticket', tradingLimiter, closeMtPosition);
router.delete('/positions', tradingLimiter, closeAllMtPositions);

export default router;
