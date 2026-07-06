import { Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'

export function handleValidation(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Datos inválidos',
      details: errors.array().map(e => ({ field: (e as any).path || e.type, message: e.msg }))
    })
    return
  }
  next()
}

export const registerValidation = [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('username').trim().notEmpty().withMessage('El username es obligatorio')
    .isLength({ min: 3, max: 30 }).withMessage('El username debe tener entre 3 y 30 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('El username solo puede contener letras, números y guión bajo'),
  body('email').trim().isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  handleValidation
]

export const loginValidation = [
  body('email').trim().isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').notEmpty().withMessage('La contraseña es obligatoria'),
  handleValidation
]
