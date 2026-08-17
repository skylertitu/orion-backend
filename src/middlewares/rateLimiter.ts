import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Demasiados intentos. Espera unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const walletLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Demasiadas operaciones de billetera. Espera unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
