import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';
import { requireModule } from '../middlewares/module.middleware';
import {
  listMine,
  saveMine,
  listPopular,
  clonePopular,
  listInUse,
  blockIndicator,
  unblockIndicator,
} from '../controllers/indicator.controller';

const router = Router();

router.use(authMiddleware);
router.use(requireModule('indicators'));

router.get('/mine', listMine);
router.put('/mine', saveMine);
router.get('/popular', listPopular);
router.post('/clone', clonePopular);

router.get('/in-use', adminMiddleware, listInUse);
router.post('/block', adminMiddleware, blockIndicator);
router.post('/unblock', adminMiddleware, unblockIndicator);

export default router;
