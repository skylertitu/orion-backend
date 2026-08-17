import { Router } from 'express';
import {
  register,
  login,
  loginWithGoogle,
  getMe,
  forgotPassword,
  resetPassword,
  resetPasswordFromFirebase,
  changePassword,
  updateProfile,
} from '../controllers/auth.controller';
import { authLimiter } from '../middlewares/rateLimiter';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateLogin, validateRegister } from '../middlewares/validation';

const router = Router();

router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.post('/google', authLimiter, loginWithGoogle);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/reset-password-firebase', authLimiter, resetPasswordFromFirebase);
router.put('/change-password', authMiddleware, changePassword);
router.put('/profile', authMiddleware, updateProfile);

export default router;
