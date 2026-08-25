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
  setUserPlan,
} from '../controllers/admin.controller';
import { adminLimiter } from '../middlewares/rateLimiter';
import { getSystemOverview, toggleSystemModule } from '../controllers/system.controller';
import { saveJupiterKey, jupiterStatus } from '../controllers/jupiter.controller';
import { getRisk, saveRisk, pauseRisk, resumeRisk } from '../controllers/risk.controller';

const router = Router();

// All admin routes require: 1) valid JWT  2) role admin or superadmin
router.use(authMiddleware, adminMiddleware, adminLimiter);

router.get('/stats', getAdminStats);
router.get('/system', getSystemOverview);
router.patch('/system/:id', toggleSystemModule);
router.get('/risk', getRisk);
router.patch('/risk', saveRisk);
router.post('/risk/pause', pauseRisk);
router.post('/risk/resume', resumeRisk);
router.get('/integrations/jupiter', jupiterStatus);
router.patch('/integrations/jupiter', saveJupiterKey);

router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/promote', promoteToAdmin);
router.post('/users/:id/demote', demoteToUser);
router.post('/users/:id/plan', setUserPlan);

export default router;
