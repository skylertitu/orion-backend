import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { superadminMiddleware } from '../middlewares/superadmin.middleware';
import { adminLimiter } from '../middlewares/rateLimiter';
import {
  listUsers,
  getUser,
  updateUser,
  setRole,
  blockUser,
  unblockUser,
  deleteUser,
} from '../controllers/superadmin.controller';

const router = Router();

router.use(authMiddleware, superadminMiddleware, adminLimiter);

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id', updateUser);
router.post('/users/:id/role', setRole);
router.post('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);
router.delete('/users/:id', deleteUser);

export default router;
