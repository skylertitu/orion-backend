import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';
import { requireModule } from '../middlewares/module.middleware';
import { requireCapability } from '../middlewares/plan.middleware';
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

router.get('/mine', requireCapability('indicators_library'), listMine);
router.put('/mine', requireCapability('indicators_editor'), saveMine);
router.get('/popular', requireCapability('indicators_library'), listPopular);
router.post('/clone', requireCapability('indicators_library'), clonePopular);

router.get('/in-use', adminMiddleware, listInUse);
router.post('/block', adminMiddleware, blockIndicator);
router.post('/unblock', adminMiddleware, unblockIndicator);

export default router;
