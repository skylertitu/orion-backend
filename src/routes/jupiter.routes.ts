import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModule } from '../middlewares/module.middleware';
import { requireCapability } from '../middlewares/plan.middleware';
import {
  listJupiterTokens,
  jupiterStatus,
  jupiterPrices,
  jupiterQuote,
  jupiterOrder,
  jupiterExecute,
  jupiterSimulate,
} from '../controllers/jupiter.controller';

const router = Router();
router.use(requireModule('jupiter'));

router.get('/tokens', listJupiterTokens);
router.get('/status', jupiterStatus);
router.get('/prices', jupiterPrices);
router.get('/quote', jupiterQuote);
router.get('/order', authMiddleware, requireCapability('jupiter_execute'), jupiterOrder);
router.post('/execute', authMiddleware, requireCapability('jupiter_execute'), jupiterExecute);
router.post('/simulate', authMiddleware, requireCapability('jupiter_execute'), jupiterSimulate);

export default router;
