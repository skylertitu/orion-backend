import { Router } from 'express';
import { getUserSignals } from '../controllers/signal.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/:userId', authMiddleware, getUserSignals);

export default router;
