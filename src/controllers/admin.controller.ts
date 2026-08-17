import { Request, Response } from 'express';
import { User, Strategy, Signal } from '../models';
import { ApiResponse } from '../types';
import { TokenPayload } from '../utils/jwt';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { routeParam } from '../utils/params';

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
      attributes: ['id', 'username', 'email', 'role', 'balance', 'createdAt'],
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
      attributes: ['id', 'username', 'email', 'role', 'balance', 'createdAt', 'updatedAt'],
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

    const { username, email, role, balance, password } = req.body;

    // Prevent admin from removing their own admin role
    if (req.user?.id === user.id && role && role !== 'admin') {
      response.success = false;
      response.error = 'No puedes quitarte tu propio rol de administrador';
      return res.status(400).json(response);
    }

    if (username !== undefined) user.username = username;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (balance !== undefined) user.balance = balance;
    if (password) user.password = await bcrypt.hash(password, 10);

    await user.save();
    response.data = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
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
export const promoteToAdmin = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const user = await User.findByPk(routeParam(req.params.id));
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }
    user.role = 'admin';
    await user.save();
    response.message = `${user.username} ahora es administrador`;
    response.data = { id: user.id, username: user.username, role: user.role };
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
    user.role = 'user';
    await user.save();
    response.message = `${user.username} ahora es usuario regular`;
    response.data = { id: user.id, username: user.username, role: user.role };
    res.json(response);
  } catch (error: any) {
    response.success = false;
    response.error = error.message;
    res.status(500).json(response);
  }
};
