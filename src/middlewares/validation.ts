import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateRegister = (req: Request, res: Response, next: NextFunction) => {
  const response: ApiResponse = { success: false };
  const { username, email, password } = req.body;

  if (username !== undefined && (typeof username !== 'string' || username.trim().length < 3)) {
    response.error = 'El usuario debe tener al menos 3 caracteres';
    return res.status(400).json(response);
  }
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    response.error = 'Correo electrónico inválido';
    return res.status(400).json(response);
  }
  if (!password || typeof password !== 'string' || !isPasswordStrong(password)) {
    response.error = PASSWORD_POLICY_MESSAGE;
    return res.status(400).json(response);
  }
  next();
};

export const validateLogin = (req: Request, res: Response, next: NextFunction) => {
  const response: ApiResponse = { success: false };
  const { email, password } = req.body;

  if (!email || typeof email !== 'string') {
    response.error = 'Correo requerido';
    return res.status(400).json(response);
  }
  if (!password || typeof password !== 'string') {
    response.error = 'Contraseña requerida';
    return res.status(400).json(response);
  }
  next();
};
