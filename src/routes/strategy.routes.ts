import { Router } from 'express';
import {
  getStrategies,
  getStrategy,
  createStrategy,
  updateStrategy,
  toggleStrategy,
  deleteStrategy,
} from '../controllers/strategy.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getStrategies);
router.post('/', createStrategy);
router.get('/:id', getStrategy);
router.patch('/:id', updateStrategy);
router.patch('/:id/toggle', toggleStrategy);
router.delete('/:id', deleteStrategy);

export default router;
