import { Router } from 'express';
import {
  createBrokerAccount,
  deleteBrokerAccount,
  getBrokerAccount,
  listBrokerAccounts,
  setPrimaryBrokerAccount,
  testBrokerAccountConnection,
  updateBrokerAccount,
} from '../controllers/brokerAccount.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModule } from '../middlewares/module.middleware';

const router = Router();

router.get('/', authMiddleware, listBrokerAccounts);
router.get('/:userId', authMiddleware, listBrokerAccounts);
router.get('/:userId/:id', authMiddleware, getBrokerAccount);
router.post('/', authMiddleware, requireModule('accounts'), createBrokerAccount);
router.patch('/:userId/:id', authMiddleware, updateBrokerAccount);
router.delete('/:userId/:id', authMiddleware, deleteBrokerAccount);
router.post('/:userId/:id/test', authMiddleware, testBrokerAccountConnection);
router.post('/:userId/:id/set-primary', authMiddleware, setPrimaryBrokerAccount);

export default router;
