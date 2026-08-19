import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { walletLimiter } from '../middlewares/rateLimiter';
import {
  listWallets,
  getWalletNetwork,
  getWalletBalance,
  requestWalletAirdrop,
  createWalletNonce,
  linkWallet,
  setPrimaryWallet,
  unlinkWallet,
  listTransfers,
  requestDeposit,
  requestWithdraw,
} from '../controllers/wallet.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', listWallets);
router.get('/transfers', listTransfers);
router.get('/network', getWalletNetwork);
router.get('/balance', getWalletBalance);
router.post('/airdrop', walletLimiter, requestWalletAirdrop);
router.post('/nonce', walletLimiter, createWalletNonce);
router.post('/link', walletLimiter, linkWallet);
router.post('/:id/primary', setPrimaryWallet);
router.post('/:id/deposit', walletLimiter, requestDeposit);
router.post('/:id/withdraw', walletLimiter, requestWithdraw);
router.delete('/:id', unlinkWallet);

export default router;
