import { Request, Response } from 'express';
import { User, Strategy, Signal } from '../models';
import { bumpSessionVersion } from '../models/User';
import { ApiResponse } from '../types';
import { TokenPayload } from '../utils/jwt';
import { Op } from 'sequelize';
import { routeParam } from '../utils/params';
import { isStaffRole, isSuperAdminRole } from '../utils/roles';
import { isUserPlan } from '../config/plans';

type AuthRequest = Request & { user?: TokenPayload };

// ─────────────────────────────────────────────
// GET /api/admin/stats
// ─────────────────────────────────────────────
export const getAdminStats = async (_req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const [totalUsers, totalSignals, totalStrategies, activeUsers] = await Promise.all([
      User.count(),
      Signal.count(),
      Strategy.count(),
      User.count({ where: { role: 'user' } }),
    ]);

    response.data = {
      totalUsers,
      totalTrades: totalSignals,
      totalStrategies,
      activeUsers,
      adminUsers: totalUsers - activeUsers,
    };
    res.json(response);
  } catch (error: any) {
    response.success = false;
    response.error = error.message || 'Error al obtener estadísticas';
    res.status(500).json(response);
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/users
// ─────────────────────────────────────────────
export const getAllUsers = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
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
      attributes: ['id', 'username', 'email', 'role', 'plan', 'balance', 'blocked', 'blockedReason', 'lastLoginAt', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    response.data = {
      users,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    };
    res.json(response);
  } catch (error: any) {
    response.success = false;
    response.error = error.message || 'Error al obtener usuarios';
    res.status(500).json(response);
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/users/:id
// ─────────────────────────────────────────────
export const getUserById = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const user = await User.findByPk(routeParam(req.params.id), {
      attributes: ['id', 'username', 'email', 'role', 'plan', 'balance', 'createdAt', 'updatedAt'],
    });
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }
    response.data = user;
    res.json(response);
  } catch (error: any) {
    response.success = false;
    response.error = error.message;
    res.status(500).json(response);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/admin/users/:id
// ─────────────────────────────────────────────
export const updateUser = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const user = await User.findByPk(routeParam(req.params.id));
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }

    const { username, email, role, balance, password, plan } = req.body;

    if (role !== undefined || password || balance !== undefined || username !== undefined || email !== undefined) {
      if (!isSuperAdminRole(req.user?.role)) {
        response.success = false;
        response.error = 'Solo superadmin puede editar datos de usuario en la base';
        return res.status(403).json(response);
      }
    }

    if (isSuperAdminRole(user.role) && !isSuperAdminRole(req.user?.role)) {
      response.success = false;
      response.error = 'Un admin no puede modificar a un superadmin';
      return res.status(403).json(response);
    }

    // Prevent admin from removing their own admin role
    if (req.user?.id === user.id && role && !isStaffRole(role)) {
      response.success = false;
      response.error = 'No puedes quitarte tu propio rol de administrador';
      return res.status(400).json(response);
    }

    const roleChanged = role !== undefined && role !== user.role;
    const passwordChanged = Boolean(password);

    if (username !== undefined) user.username = username;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
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
    if (balance !== undefined) user.balance = balance;
    if (password) user.password = password;
    if (roleChanged || passwordChanged) bumpSessionVersion(user);

    await user.save();
    response.data = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      plan: user.plan,
      balance: user.balance,
    };
    response.message = 'Usuario actualizado correctamente';
    res.json(response);
  } catch (error: any) {
    response.success = false;
    response.error = error.message || 'Error al actualizar usuario';
    res.status(500).json(response);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/admin/users/:id
// ─────────────────────────────────────────────
export const deleteUser = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    if (!isSuperAdminRole(req.user?.role)) {
      response.success = false;
      response.error = 'Solo superadmin puede eliminar usuarios';
      return res.status(403).json(response);
    }
    if (req.user?.id === parseInt(routeParam(req.params.id), 10)) {
      response.success = false;
      response.error = 'No puedes eliminar tu propia cuenta de administrador';
      return res.status(400).json(response);
    }

    const user = await User.findByPk(routeParam(req.params.id));
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }

    await user.destroy();
    response.message = `Usuario "${user.username}" eliminado correctamente`;
    res.json(response);
  } catch (error: any) {
    response.success = false;
    response.error = error.message || 'Error al eliminar usuario';
    res.status(500).json(response);
  }
};

// ─────────────────────────────────────────────
// POST /api/admin/users/:id/promote
// ─────────────────────────────────────────────
export const promoteToAdmin = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    if (!isSuperAdminRole(req.user?.role)) {
      response.success = false;
      response.error = 'Solo superadmin puede promover administradores';
      return res.status(403).json(response);
    }
    const user = await User.findByPk(routeParam(req.params.id));
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }
    if (isSuperAdminRole(user.role)) {
      response.success = false;
      response.error = 'Un superadmin no se cambia por esta vía. Usa el panel Superadmin';
      return res.status(400).json(response);
    }
    user.role = 'admin';
    user.plan = null;
    bumpSessionVersion(user);
    await user.save();
    response.message = `${user.username} ahora es administrador`;
    response.data = { id: user.id, username: user.username, role: user.role, plan: user.plan };
    res.json(response);
  } catch (error: any) {
    response.success = false;
    response.error = error.message;
    res.status(500).json(response);
  }
};

// ─────────────────────────────────────────────
// POST /api/admin/users/:id/demote
// ─────────────────────────────────────────────
export const demoteToUser = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    if (!isSuperAdminRole(req.user?.role)) {
      response.success = false;
      response.error = 'Solo superadmin puede quitar el rol de administrador';
      return res.status(403).json(response);
    }
    if (req.user?.id === parseInt(routeParam(req.params.id), 10)) {
      response.success = false;
      response.error = 'No puedes degradar tu propia cuenta';
      return res.status(400).json(response);
    }
    const user = await User.findByPk(routeParam(req.params.id));
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }
    if (isSuperAdminRole(user.role)) {
      response.success = false;
      response.error = 'Un superadmin no se degrada por esta vía. Usa el panel Superadmin';
      return res.status(400).json(response);
    }
    user.role = 'user';
    if (!user.plan) user.plan = 'builder';
    bumpSessionVersion(user);
    await user.save();
    response.message = `${user.username} ahora es usuario regular`;
    response.data = { id: user.id, username: user.username, role: user.role, plan: user.plan };
    res.json(response);
  } catch (error: any) {
    response.success = false;
    response.error = error.message;
    res.status(500).json(response);
  }
};

export const setUserPlan = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const user = await User.findByPk(routeParam(req.params.id));
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }
    if (isStaffRole(user.role)) {
      response.success = false;
      response.error = 'Admin y superadmin no usan plan de usuario.';
      return res.status(400).json(response);
    }
    const plan = req.body?.plan;
    if (!isUserPlan(plan)) {
      response.success = false;
      response.error = 'Plan inválido. Usa analyst, signals o builder';
      return res.status(400).json(response);
    }
    user.plan = plan;
    await user.save();
    response.message = `${user.username} ahora es plan ${plan}`;
    response.data = { id: user.id, username: user.username, role: user.role, plan: user.plan };
    res.json(response);
  } catch (error: any) {
    response.success = false;
    response.error = error.message || 'Error al asignar plan';
    res.status(500).json(response);
  }
};
