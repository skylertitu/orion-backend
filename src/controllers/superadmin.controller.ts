import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { User } from '../models';
import { bumpSessionVersion } from '../models/User';
import { ApiResponse } from '../types';
import { TokenPayload } from '../utils/jwt';
import { routeParam } from '../utils/params';
import { isUserPlan } from '../config/plans';
import { isStaffRole, isSuperAdminRole, isUserRole, type UserRole } from '../utils/roles';

type AuthRequest = Request & { user?: TokenPayload };

const USER_PUBLIC_ATTRS = [
  'id',
  'username',
  'email',
  'role',
  'plan',
  'balance',
  'firstName',
  'lastName',
  'phone',
  'country',
  'language',
  'timezone',
  'emailVerified',
  'blocked',
  'blockedReason',
  'blockedAt',
  'lastLoginAt',
  'createdAt',
  'updatedAt',
] as const;

function toRow(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    plan: user.plan,
    balance: user.balance,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    country: user.country,
    language: user.language,
    timezone: user.timezone,
    emailVerified: user.emailVerified,
    blocked: Boolean(user.blocked),
    blockedReason: user.blockedReason,
    blockedAt: user.blockedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function superadminCount(): Promise<number> {
  return User.count({ where: { role: 'superadmin' } });
}

function forbidSelf(req: AuthRequest, userId: number, action: string): string | null {
  if (req.user?.id === userId) return `No puedes ${action} tu propia cuenta`;
  return null;
}

export const listUsers = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;
    const where = search
      ? {
          [Op.or]: [
            { username: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {};

    const { rows: users, count } = await User.findAndCountAll({
      where,
      attributes: [...USER_PUBLIC_ATTRS],
      order: [['id', 'ASC']],
      limit,
      offset,
    });

    response.data = {
      users: users.map(toRow),
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    };
    res.json(response);
  } catch (error: unknown) {
    response.success = false;
    response.error = error instanceof Error ? error.message : 'Error al obtener usuarios';
    res.status(500).json(response);
  }
};

export const getUser = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const user = await User.findByPk(routeParam(req.params.id), { attributes: [...USER_PUBLIC_ATTRS] });
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }
    response.data = toRow(user);
    res.json(response);
  } catch (error: unknown) {
    response.success = false;
    response.error = error instanceof Error ? error.message : 'Error';
    res.status(500).json(response);
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const user = await User.findByPk(routeParam(req.params.id));
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }

    const {
      username,
      email,
      firstName,
      lastName,
      phone,
      country,
      language,
      timezone,
      role,
      plan,
      balance,
      password,
      emailVerified,
    } = req.body;

    if (role !== undefined) {
      if (!isUserRole(role)) {
        response.success = false;
        response.error = 'Rol inválido. Usa user, admin o superadmin';
        return res.status(400).json(response);
      }
      if (req.user?.id === user.id && role !== 'superadmin') {
        response.success = false;
        response.error = 'No puedes quitarte tu propio rol de superadmin';
        return res.status(400).json(response);
      }
      if (isSuperAdminRole(user.role) && role !== 'superadmin' && (await superadminCount()) <= 1) {
        response.success = false;
        response.error = 'Debe quedar al menos un superadmin';
        return res.status(400).json(response);
      }
    }

    const roleChanged = role !== undefined && role !== user.role;
    const passwordChanged = Boolean(password);

    if (username !== undefined) user.username = String(username).trim();
    if (email !== undefined) user.email = String(email).trim().toLowerCase();
    if (firstName !== undefined) user.firstName = String(firstName).trim() || null;
    if (lastName !== undefined) user.lastName = String(lastName).trim() || null;
    if (phone !== undefined) user.phone = String(phone).trim() || null;
    if (country !== undefined) user.country = String(country).trim() || 'Global';
    if (language !== undefined) user.language = String(language).trim() || 'es';
    if (timezone !== undefined) user.timezone = String(timezone).trim() || 'UTC-5';
    if (emailVerified !== undefined) user.emailVerified = Boolean(emailVerified);
    if (balance !== undefined) user.balance = Number(balance);
    if (password) user.password = password;
    if (role !== undefined) {
      user.role = role as UserRole;
      if (isStaffRole(user.role)) user.plan = null;
    }
    if (plan !== undefined) {
      if (isStaffRole(user.role)) {
        user.plan = null;
      } else if (!isUserPlan(plan)) {
        response.success = false;
        response.error = 'Plan inválido. Usa analyst, signals o builder';
        return res.status(400).json(response);
      } else {
        user.plan = plan;
      }
    }

    if (roleChanged || passwordChanged) bumpSessionVersion(user);
    await user.save();
    response.data = toRow(user);
    response.message = 'Usuario actualizado en base de datos';
    res.json(response);
  } catch (error: unknown) {
    response.success = false;
    response.error = error instanceof Error ? error.message : 'Error al actualizar usuario';
    res.status(500).json(response);
  }
};

export const setRole = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const role = req.body?.role;
    if (!isUserRole(role)) {
      response.success = false;
      response.error = 'Rol inválido. Usa user, admin o superadmin';
      return res.status(400).json(response);
    }
    const user = await User.findByPk(routeParam(req.params.id));
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }
    const selfErr = role !== 'superadmin' ? forbidSelf(req, user.id, 'cambiar el rol de') : null;
    if (selfErr && req.user?.id === user.id && role !== 'superadmin') {
      response.success = false;
      response.error = 'No puedes quitarte tu propio rol de superadmin';
      return res.status(400).json(response);
    }
    if (isSuperAdminRole(user.role) && role !== 'superadmin' && (await superadminCount()) <= 1) {
      response.success = false;
      response.error = 'Debe quedar al menos un superadmin';
      return res.status(400).json(response);
    }
    user.role = role;
    user.plan = isStaffRole(role) ? null : user.plan || 'builder';
    bumpSessionVersion(user);
    await user.save();
    response.data = toRow(user);
    response.message = `${user.username} ahora es ${role}`;
    res.json(response);
  } catch (error: unknown) {
    response.success = false;
    response.error = error instanceof Error ? error.message : 'Error al cambiar rol';
    res.status(500).json(response);
  }
};

export const blockUser = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const user = await User.findByPk(routeParam(req.params.id));
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }
    const selfErr = forbidSelf(req, user.id, 'bloquear');
    if (selfErr) {
      response.success = false;
      response.error = selfErr;
      return res.status(400).json(response);
    }
    if (isSuperAdminRole(user.role) && (await superadminCount()) <= 1) {
      response.success = false;
      response.error = 'No puedes bloquear al único superadmin';
      return res.status(400).json(response);
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 255) : '';
    user.blocked = true;
    user.blockedReason = reason || 'Bloqueado por superadmin';
    user.blockedAt = new Date();
    bumpSessionVersion(user);
    await user.save();
    response.data = toRow(user);
    response.message = `${user.username} bloqueado`;
    res.json(response);
  } catch (error: unknown) {
    response.success = false;
    response.error = error instanceof Error ? error.message : 'Error al bloquear';
    res.status(500).json(response);
  }
};

export const unblockUser = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const user = await User.findByPk(routeParam(req.params.id));
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }
    user.blocked = false;
    user.blockedReason = null;
    user.blockedAt = null;
    bumpSessionVersion(user);
    await user.save();
    response.data = toRow(user);
    response.message = `${user.username} desbloqueado`;
    res.json(response);
  } catch (error: unknown) {
    response.success = false;
    response.error = error instanceof Error ? error.message : 'Error al desbloquear';
    res.status(500).json(response);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const user = await User.findByPk(routeParam(req.params.id));
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }
    const selfErr = forbidSelf(req, user.id, 'eliminar');
    if (selfErr) {
      response.success = false;
      response.error = selfErr;
      return res.status(400).json(response);
    }
    if (isSuperAdminRole(user.role) && (await superadminCount()) <= 1) {
      response.success = false;
      response.error = 'No puedes eliminar al único superadmin';
      return res.status(400).json(response);
    }
    const name = user.username;
    await user.destroy();
    response.message = `Usuario "${name}" eliminado de la base de datos`;
    res.json(response);
  } catch (error: unknown) {
    response.success = false;
    response.error = error instanceof Error ? error.message : 'Error al eliminar';
    res.status(500).json(response);
  }
};
