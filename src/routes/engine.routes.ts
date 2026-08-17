import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModule } from '../middlewares/module.middleware';
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
router.post('/order', authMiddleware, requireModule('trading'), executeOrder);
router.get('/positions', authMiddleware, requireModule('trading'), getPositions);
router.delete('/positions/:broker/:ticket', authMiddleware, requireModule('trading'), closePosition);

export default router;
