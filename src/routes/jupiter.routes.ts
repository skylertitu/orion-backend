import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModule } from '../middlewares/module.middleware';
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
router.get('/order', authMiddleware, jupiterOrder);
router.post('/execute', authMiddleware, jupiterExecute);
router.post('/simulate', authMiddleware, jupiterSimulate);

export default router;
