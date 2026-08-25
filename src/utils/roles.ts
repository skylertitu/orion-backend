import { Op } from 'sequelize';
import { User } from '../models';
import { logger } from './logger';

export const USER_ROLES = ['user', 'admin', 'superadmin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export function isStaffRole(role?: string | null): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function isSuperAdminRole(role?: string | null): boolean {
  return role === 'superadmin';
}

export function adminEmailsFromEnv(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function superadminEmailsFromEnv(): string[] {
  return (process.env.SUPERADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function roleForNewUser(email: string): Promise<UserRole> {
  const normalized = email.trim().toLowerCase();
  if (superadminEmailsFromEnv().includes(normalized)) return 'superadmin';
  if (adminEmailsFromEnv().includes(normalized)) return 'admin';
  const staffCount = await User.count({ where: { role: { [Op.in]: ['admin', 'superadmin'] } } });
  return staffCount === 0 ? 'superadmin' : 'user';
}

export async function ensureBootstrapAdmin(): Promise<void> {
  const superEmails = superadminEmailsFromEnv();
  if (superEmails.length > 0) {
    const [updated] = await User.update(
      { role: 'superadmin', plan: null },
      { where: { email: { [Op.in]: superEmails } } }
    );
    if (updated > 0) {
      logger.info(`[auth] SUPERADMIN_EMAILS: ${updated} usuario(s) con rol superadmin`);
    }
  }

  const adminEmails = adminEmailsFromEnv();
  if (adminEmails.length > 0) {
    const [updated] = await User.update(
      { role: 'admin', plan: null },
      {
        where: {
          email: { [Op.in]: adminEmails },
          role: { [Op.ne]: 'superadmin' },
        },
      }
    );
    if (updated > 0) {
      logger.info(`[auth] ADMIN_EMAILS: ${updated} usuario(s) con rol admin`);
    }
  }

  const superCount = await User.count({ where: { role: 'superadmin' } });
  if (superCount > 0) return;

  const firstStaff = await User.findOne({
    where: { role: { [Op.in]: ['admin', 'superadmin'] } },
    order: [['id', 'ASC']],
  });
  if (firstStaff) {
    firstStaff.role = 'superadmin';
    firstStaff.plan = null;
    await firstStaff.save();
    logger.info(`[auth] Primer staff promovido a superadmin id=${firstStaff.id} email=${firstStaff.email}`);
    return;
  }

  const first = await User.findOne({ order: [['id', 'ASC']] });
  if (!first) return;
  first.role = 'superadmin';
  first.plan = null;
  await first.save();
  logger.info(`[auth] Primer usuario promovido a superadmin id=${first.id} email=${first.email}`);
}
