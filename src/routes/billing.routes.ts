import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  billingStatus,
  confirmCheckoutSession,
  createCheckoutSession,
  createPlanRequest,
  myPlanRequests,
} from '../controllers/billing.controller';

const router = Router();

router.get('/status', billingStatus);
router.use(authMiddleware);
router.get('/requests/mine', myPlanRequests);
router.post('/requests', createPlanRequest);
router.post('/checkout', createCheckoutSession);
router.post('/confirm', confirmCheckoutSession);

export default router;
