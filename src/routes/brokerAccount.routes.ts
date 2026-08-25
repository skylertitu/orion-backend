import { Router } from 'express';
import {
  createBrokerAccount,
  deleteBrokerAccount,
  getBrokerAccount,
  listBrokerAccounts,
  setPrimaryBrokerAccount,
  setBrokerAccountMode,
  testBrokerAccountConnection,
  updateBrokerAccount,
} from '../controllers/brokerAccount.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModule } from '../middlewares/module.middleware';
import { requireCapability } from '../middlewares/plan.middleware';

const router = Router();

router.use(authMiddleware);
router.use(requireCapability('broker_accounts'));

router.get('/', listBrokerAccounts);
router.get('/:userId', listBrokerAccounts);
router.get('/:userId/:id', getBrokerAccount);
router.post('/', requireModule('accounts'), createBrokerAccount);
router.patch('/:userId/:id', updateBrokerAccount);
router.delete('/:userId/:id', deleteBrokerAccount);
router.post('/:userId/:id/test', testBrokerAccountConnection);
router.post('/:userId/:id/set-primary', setPrimaryBrokerAccount);
router.post('/:userId/:id/mode', setBrokerAccountMode);

export default router;
