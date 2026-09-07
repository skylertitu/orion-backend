import { Router } from 'express';
import { analyze, getSignals, health } from '../controllers/lucy.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModule } from '../middlewares/module.middleware';
import { requireAnyCapability, requireCapability } from '../middlewares/plan.middleware';

const router = Router();

// Chat / análisis: gratis con lucy_chat (cupo en frontend) o planes superiores.
router.post(
  '/analyze',
  authMiddleware,
  requireModule('lucy'),
  requireAnyCapability('lucy_chat', 'lucy_signals', 'lucy_control'),
  analyze
);
router.get('/signals/:symbol', authMiddleware, requireModule('lucy'), requireCapability('lucy_signals'), getSignals);
router.get('/health', health);

export default router;
