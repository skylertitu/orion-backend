import db from '../../database/db.js'

export class NotificationsService {
  getAll(userId: string): any[] {
    return db.prepare('SELECT * FROM notifications WHERE user_id = ? OR user_id = ? ORDER BY created_at DESC').all(userId, 'all')
  }

  getUnreadCount(userId: string): number {
    return (db.prepare("SELECT COUNT(*) as count FROM notifications WHERE (user_id = ? OR user_id = 'all') AND read = 0").get(userId) as { count: number }).count
  }

  markRead(notificationId: string): { ok: boolean } {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(notificationId)
    return { ok: true }
  }

  markAllRead(userId: string): { ok: boolean } {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? OR user_id = 'all'").run(userId)
    return { ok: true }
  }
}
