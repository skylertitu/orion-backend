import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  getMtStatus,
  getMtSymbols,
  getMtPositions,
  executeMtOrder,
  closeMtPosition,
  closeAllMtPositions,
} from '../controllers/metatrader.controller';

const router = Router();

router.get('/status', authMiddleware, getMtStatus);
router.get('/symbols', authMiddleware, getMtSymbols);
router.get('/positions', authMiddleware, getMtPositions);
router.post('/order', authMiddleware, executeMtOrder);
router.delete('/positions/:ticket', authMiddleware, closeMtPosition);
router.delete('/positions', authMiddleware, closeAllMtPositions);

export default router;
