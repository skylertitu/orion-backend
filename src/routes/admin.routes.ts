import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';
import {
  getAdminStats,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  promoteToAdmin,
  demoteToUser,
} from '../controllers/admin.controller';
import { getSystemOverview, toggleSystemModule } from '../controllers/system.controller';
import { saveJupiterKey, jupiterStatus } from '../controllers/jupiter.controller';

const router = Router();

// All admin routes require: 1) valid JWT  2) role === 'admin'
router.use(authMiddleware, adminMiddleware);

router.get('/stats', getAdminStats);
router.get('/system', getSystemOverview);
router.patch('/system/:id', toggleSystemModule);
router.get('/integrations/jupiter', jupiterStatus);
router.patch('/integrations/jupiter', saveJupiterKey);

router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/promote', promoteToAdmin);
router.post('/users/:id/demote', demoteToUser);

export default router;
