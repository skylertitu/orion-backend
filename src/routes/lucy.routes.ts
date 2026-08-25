import { Router } from 'express';
import { analyze, getSignals, health } from '../controllers/lucy.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModule } from '../middlewares/module.middleware';
import { requireCapability } from '../middlewares/plan.middleware';

const router = Router();

router.post('/analyze', authMiddleware, requireModule('lucy'), requireCapability('lucy_control'), analyze);
router.get('/signals/:symbol', authMiddleware, requireModule('lucy'), requireCapability('lucy_signals'), getSignals);
router.get('/health', health);

export default router;
