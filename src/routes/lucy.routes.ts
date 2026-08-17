import { Router } from 'express';
import { analyze, getSignals, health } from '../controllers/lucy.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModule } from '../middlewares/module.middleware';

const router = Router();

router.post('/analyze', authMiddleware, requireModule('lucy'), analyze);
router.get('/signals/:symbol', authMiddleware, requireModule('lucy'), getSignals);
router.get('/health', health);

export default router;
