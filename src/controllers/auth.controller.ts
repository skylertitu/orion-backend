import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { User } from '../models';
import { bumpSessionVersion } from '../models/User';
import { ApiResponse } from '../types';
import { getAppUrl, isDevResetLinkEnabled, sendOrionPasswordResetEmail, sendOrionVerifyEmail } from '../utils/mailer';
import { signToken, signEmailVerifyToken, verifyEmailVerifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { syncFirebasePassword, verifyFirebaseIdToken } from '../config/firebase';
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy';
import { roleForNewUser } from '../utils/roles';
import { defaultPlanForRole, normalizePlan } from '../config/plans';

function findUserByEmail(email: string) {
  return User.findOne({ where: { email: { [Op.iLike]: email.trim() } } });
}

function parseRegisterError(error: any): string {
  if (error.name === 'SequelizeUniqueConstraintError') {
    const field = error.errors?.[0]?.path;
    if (field === 'email') return 'Este correo ya está registrado';
    if (field === 'username') return 'Este nombre de usuario ya existe';
    return 'El usuario o correo ya está registrado';
  }
  return error.message || 'Error al registrar usuario';
}

function userToDTO(user: User) {
  const plan = normalizePlan(user.role, user.plan);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    plan,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    phone: user.phone || '',
    country: user.country || 'Global',
    language: user.language || 'es',
    timezone: user.timezone || 'UTC-5',
    avatar: user.avatar || null,
    termsAccepted: user.termsAccepted,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt ? user.createdAt.toISOString() : null,
  };
}

function issueSession(user: User, rememberMe?: boolean) {
  const tokenExpiration = rememberMe ? '7d' : '8h';
  const token = signToken(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      plan: normalizePlan(user.role, user.plan),
      sv: user.sessionVersion || 0,
    },
    tokenExpiration
  );
  return { ...userToDTO(user), token };
}

async function uniqueUsername(base: string): Promise<string> {
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'user';
  let candidate = cleaned;
  let n = 1;
  while (await User.findOne({ where: { username: candidate } })) {
    candidate = `${cleaned}${n++}`.slice(0, 100);
  }
  return candidate;
}

export const register = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const { username, email, password, firstName, lastName, phone, termsAccepted } = req.body;

    if (!email?.trim() || !password) {
      response.success = false;
      response.error = 'Completa correo y contraseña';
      return res.status(400).json(response);
    }

    const finalUsername = (username?.trim() || email.split('@')[0]).trim();
    const normalizedEmail = email.trim().toLowerCase();
    const role = await roleForNewUser(normalizedEmail);

    const user = await User.create({
      username: finalUsername,
      email: normalizedEmail,
      password,
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      phone: phone?.trim() || null,
      termsAccepted: termsAccepted ?? true,
      role,
      plan: defaultPlanForRole(role),
    });

    logger.info(`[auth] Nuevo usuario creado id=${user.id} email=${user.email} username=${user.username} role=${user.role}`);
    response.data = issueSession(user, false);
    response.message = 'Cuenta creada correctamente';
    res.status(201).json(response);
  } catch (error: any) {
    const message = parseRegisterError(error);
    logger.error(`[auth] Error al crear usuario email=${req.body?.email || '?'}: ${message}`);
    response.success = false;
    response.error = message;
    res.status(400).json(response);
  }
};

export const login = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const { email, password, rememberMe } = req.body;

    if (!email?.trim() || !password) {
      response.success = false;
      response.error = 'Completa correo y contraseña';
      return res.status(400).json(response);
    }

    const user = await findUserByEmail(email);
    if (!user) {
      logger.warn(`[auth] Login fallido: no existe ${email.trim()}`);
      response.success = false;
      response.error = 'Correo o contraseña incorrectos';
      return res.status(401).json(response);
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      logger.warn(`[auth] Login fallido: contraseña incorrecta email=${user.email} id=${user.id}`);
      response.success = false;
      response.error = 'Correo o contraseña incorrectos';
      return res.status(401).json(response);
    }

    if (user.blocked) {
      response.success = false;
      response.error = user.blockedReason
        ? `Cuenta bloqueada: ${user.blockedReason}`
        : 'Esta cuenta está bloqueada';
      return res.status(403).json(response);
    }

    user.lastLoginAt = new Date();
    await user.save();

    logger.info(`[auth] Login id=${user.id} email=${user.email}`);
    response.data = issueSession(user, rememberMe);
    response.message = 'Inicio de sesión exitoso';
    res.json(response);
  } catch (error: any) {
    logger.error(`[auth] Error al iniciar sesión: ${error.message || error}`);
    response.success = false;
    response.error = 'Error al iniciar sesión';
    res.status(400).json(response);
  }
};

export const loginWithGoogle = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const { idToken, rememberMe } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      response.success = false;
      response.error = 'Token de Google requerido';
      return res.status(400).json(response);
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      logger.error('[auth] Google: el token no trae un correo válido');
      response.success = false;
      response.error = 'La cuenta de Google no tiene un correo válido';
      return res.status(400).json(response);
    }

    const displayName = (decoded.name || '').trim();
    const [firstName, ...rest] = displayName.split(' ');
    const lastName = rest.join(' ') || null;
    const avatar = typeof decoded.picture === 'string' ? decoded.picture.slice(0, 512) : null;

    let user = await User.findOne({
      where: {
        [Op.or]: [{ firebaseUid: decoded.uid }, { email: { [Op.iLike]: email } }],
      },
    });

    if (!user) {
      const role = await roleForNewUser(email);
      user = await User.create({
        username: await uniqueUsername(email.split('@')[0]),
        email,
        password: crypto.randomBytes(32).toString('hex'),
        firebaseUid: decoded.uid,
        firstName: firstName || null,
        lastName,
        avatar,
        termsAccepted: true,
        emailVerified: decoded.email_verified === true,
        lastLoginAt: new Date(),
        role,
        plan: defaultPlanForRole(role),
      });
      logger.info(
        `[auth] Nuevo usuario creado vía Google id=${user.id} email=${user.email} username=${user.username} role=${user.role}`
      );
    } else {
      if (user.firebaseUid && user.firebaseUid !== decoded.uid) {
        logger.warn(`[auth] Google: correo ${email} ya asociado a otro firebaseUid`);
        response.success = false;
        response.error = 'Este correo ya está asociado a otra cuenta';
        return res.status(409).json(response);
      }
      if (!user.firebaseUid) user.firebaseUid = decoded.uid;
      if (decoded.email_verified) user.emailVerified = true;
      if (!user.avatar && avatar) user.avatar = avatar;
      if (!user.firstName && firstName) user.firstName = firstName;
      if (!user.lastName && lastName) user.lastName = lastName;
      user.lastLoginAt = new Date();
      await user.save();
      logger.info(`[auth] Login Google (usuario existente) id=${user.id} email=${user.email}`);
    }

    if (user.blocked) {
      response.success = false;
      response.error = user.blockedReason
        ? `Cuenta bloqueada: ${user.blockedReason}`
        : 'Esta cuenta está bloqueada';
      return res.status(403).json(response);
    }

    response.data = issueSession(user, rememberMe);
    response.message = 'Inicio de sesión con Google exitoso';
    res.json(response);
  } catch (err: any) {
    const status = err.status || 401;
    logger.error(`[auth] Error en login Google (${status}): ${err.message || err}`);
    response.success = false;
    response.error =
      status === 503
        ? err.message
        : 'No se pudo verificar la cuenta de Google. Intenta de nuevo.';
    res.status(status === 503 ? 503 : 401).json(response);
  }
};

export const getMe = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      response.success = false;
      response.error = 'No autenticado';
      return res.status(401).json(response);
    }

    const user = await User.findByPk(userId);
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }

    response.data = userToDTO(user);
    res.json(response);
  } catch {
    response.success = false;
    response.error = 'Error al obtener sesión de usuario';
    res.status(400).json(response);
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  const genericMessage =
    'Si el correo existe, se enviarán las instrucciones para restablecer la contraseña';
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      response.success = false;
      response.error = 'Ingresa tu correo electrónico';
      return res.status(400).json(response);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      logger.info(`[auth] Recuperación: no hay usuario para ${normalizedEmail}`);
      response.message = genericMessage;
      return res.json(response);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000);
    await user.save();

    const resetUrl = `${getAppUrl()}/reset-password?token=${resetToken}`;
    const googleAccount = Boolean(user.firebaseUid);
    logger.info(
      `[auth] Recuperación solicitada id=${user.id} email=${user.email} google=${googleAccount}`
    );

    const orionSent = await sendOrionPasswordResetEmail({
      to: user.email,
      resetUrl,
      googleAccount,
    });

    if (!orionSent) {
      logger.warn(
        `[auth] Sin SMTP: no se envió correo de AutoTrade a ${user.email}. Usa el enlace de la app.`
      );
    }

    if (isDevResetLinkEnabled()) {
      logger.info(`[auth] Enlace de recuperación (desarrollo): ${resetUrl}`);
      response.data = {
        resetToken,
        resetUrl,
        emailSent: orionSent,
        googleAccount,
      };
    }

    response.message = genericMessage;
    res.json(response);
  } catch (error: any) {
    logger.error(`[auth] Error al solicitar recuperación: ${error.message || error}`);
    response.success = false;
    response.error = 'Error al solicitar recuperación de contraseña';
    res.status(400).json(response);
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const { token, newPassword } = req.body;
    if (!token || typeof newPassword !== 'string' || !isPasswordStrong(newPassword)) {
      response.success = false;
      response.error = !token ? 'Token inválido' : PASSWORD_POLICY_MESSAGE;
      return res.status(400).json(response);
    }

    const user = await User.findOne({ where: { resetPasswordToken: token } });
    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      response.success = false;
      response.error = 'El enlace de recuperación es inválido o ha expirado';
      return res.status(400).json(response);
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    bumpSessionVersion(user);
    await user.save();

    if (user.firebaseUid) {
      await syncFirebasePassword(user.firebaseUid, newPassword);
    }

    logger.info(`[auth] Contraseña restablecida id=${user.id} email=${user.email}`);

    response.message = 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.';
    res.json(response);
  } catch {
    response.success = false;
    response.error = 'Error al restablecer la contraseña';
    res.status(400).json(response);
  }
};

export const resetPasswordFromFirebase = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const { idToken, newPassword } = req.body;
    if (!idToken || typeof idToken !== 'string' || typeof newPassword !== 'string' || !isPasswordStrong(newPassword)) {
      response.success = false;
      response.error = !idToken ? 'Token inválido' : PASSWORD_POLICY_MESSAGE;
      return res.status(400).json(response);
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      response.success = false;
      response.error = 'El token de Firebase no trae un correo válido';
      return res.status(400).json(response);
    }

    const user = await User.findOne({
      where: { [Op.or]: [{ firebaseUid: decoded.uid }, { email: { [Op.iLike]: email } }] },
    });
    if (!user) {
      response.success = false;
      response.error = 'No hay una cuenta de AutoTrade con ese correo';
      return res.status(404).json(response);
    }

    if (!user.firebaseUid) user.firebaseUid = decoded.uid;
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    bumpSessionVersion(user);
    await user.save();

    logger.info(`[auth] Contraseña restablecida vía Firebase id=${user.id} email=${user.email}`);
    response.message = 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.';
    res.json(response);
  } catch (error: any) {
    logger.error(`[auth] Error al restablecer vía Firebase: ${error.message || error}`);
    response.success = false;
    response.error = 'Error al restablecer la contraseña';
    res.status(400).json(response);
  }
};

export const changePassword = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = (req as any).user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      response.success = false;
      response.error = 'Completa todos los campos requeridos';
      return res.status(400).json(response);
    }

    if (typeof newPassword !== 'string' || !isPasswordStrong(newPassword)) {
      response.success = false;
      response.error = PASSWORD_POLICY_MESSAGE;
      return res.status(400).json(response);
    }

    const user = await User.findByPk(userId);
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      response.success = false;
      response.error = user.firebaseUid
        ? 'Esta cuenta inicia sesión con Google. No usa contraseña local.'
        : 'La contraseña actual no es correcta';
      return res.status(400).json(response);
    }

    user.password = newPassword;
    bumpSessionVersion(user);
    await user.save();

    if (user.firebaseUid) {
      await syncFirebasePassword(user.firebaseUid, newPassword);
    }

    response.message = 'Contraseña modificada con éxito. Vuelve a iniciar sesión.';
    res.json(response);
  } catch {
    response.success = false;
    response.error = 'Error al modificar la contraseña';
    res.status(400).json(response);
  }
};

export const logout = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = (req as any).user?.id;
    if (userId) {
      const user = await User.findByPk(userId);
      if (user) {
        bumpSessionVersion(user);
        await user.save();
      }
    }
    response.message = 'Sesión cerrada';
    res.json(response);
  } catch {
    response.success = false;
    response.error = 'Error al cerrar sesión';
    res.status(400).json(response);
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = (req as any).user?.id;
    const { firstName, lastName, phone, country, language, timezone } = req.body;

    if (!userId) {
      response.success = false;
      response.error = 'No autenticado';
      return res.status(401).json(response);
    }

    const user = await User.findByPk(userId);
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }

    if (firstName !== undefined) user.firstName = firstName?.trim() || null;
    if (lastName !== undefined) user.lastName = lastName?.trim() || null;
    if (phone !== undefined) user.phone = phone?.trim() || null;
    if (country !== undefined) user.country = country?.trim() || 'Global';
    if (language !== undefined) {
      const allowed = new Set(['es', 'en', 'pt', 'fr', 'de', 'it', 'zh', 'ja', 'ko', 'ar', 'ru']);
      const lang = String(language).trim().toLowerCase();
      user.language = allowed.has(lang) ? lang : 'es';
    }
    if (timezone !== undefined) user.timezone = timezone?.trim() || 'UTC-5';

    await user.save();

    response.data = userToDTO(user);
    response.message = 'Perfil actualizado con éxito';
    res.json(response);
  } catch {
    response.success = false;
    response.error = 'Error al actualizar información del perfil';
    res.status(400).json(response);
  }
};

export const requestEmailVerification = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = (req as any).user?.id;
    const user = userId ? await User.findByPk(userId) : null;
    if (!user) {
      response.success = false;
      response.error = 'No autenticado';
      return res.status(401).json(response);
    }
    if (user.emailVerified) {
      response.message = 'Tu correo ya está validado';
      response.data = userToDTO(user);
      return res.json(response);
    }

    const token = signEmailVerifyToken(user.id, user.email);
    const verifyUrl = `${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    const sent = await sendOrionVerifyEmail({ to: user.email, verifyUrl });

    if (isDevResetLinkEnabled()) {
      response.data = { verifyUrl, emailSent: sent };
    } else {
      response.data = { emailSent: sent };
    }
    response.message = sent
      ? 'Te enviamos un correo para validar la cuenta'
      : 'No se pudo enviar el correo. Usa el enlace de validación si aparece en pantalla.';
    res.json(response);
  } catch (error: any) {
    logger.error(`[auth] Error al pedir validación: ${error.message || error}`);
    response.success = false;
    response.error = 'No se pudo pedir la validación del correo';
    res.status(400).json(response);
  }
};

export const confirmEmailVerification = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const payload = verifyEmailVerifyToken(token);
    if (!payload) {
      response.success = false;
      response.error = 'El enlace de validación es inválido o caducó';
      return res.status(400).json(response);
    }

    const user = await User.findByPk(payload.id);
    if (!user || user.email.toLowerCase() !== payload.email.toLowerCase()) {
      response.success = false;
      response.error = 'El enlace de validación no coincide con la cuenta';
      return res.status(400).json(response);
    }

    user.emailVerified = true;
    await user.save();
    response.data = userToDTO(user);
    response.message = 'Cuenta validada correctamente';
    res.json(response);
  } catch {
    response.success = false;
    response.error = 'No se pudo validar el correo';
    res.status(400).json(response);
  }
};
