import { Op } from 'sequelize';
import { User } from '../models';
import { logger } from './logger';

export function adminEmailsFromEnv(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function roleForNewUser(email: string): Promise<'user' | 'admin'> {
  const normalized = email.trim().toLowerCase();
  if (adminEmailsFromEnv().includes(normalized)) return 'admin';
  const adminCount = await User.count({ where: { role: 'admin' } });
  return adminCount === 0 ? 'admin' : 'user';
}

export async function ensureBootstrapAdmin(): Promise<void> {
  const emails = adminEmailsFromEnv();
  if (emails.length > 0) {
    const [updated] = await User.update(
      { role: 'admin' },
      { where: { email: { [Op.in]: emails } } }
    );
    if (updated > 0) {
      logger.info(`[auth] ADMIN_EMAILS: ${updated} usuario(s) con rol admin`);
    }
  }

  const adminCount = await User.count({ where: { role: 'admin' } });
  if (adminCount > 0) return;

  const first = await User.findOne({ order: [['id', 'ASC']] });
  if (!first) return;
  first.role = 'admin';
  await first.save();
  logger.info(`[auth] Primer usuario promovido a admin id=${first.id} email=${first.email}`);
}
