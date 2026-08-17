const MT_MAGIC_BASE = parseInt(process.env.MT_MAGIC_BASE || '20240000', 10);

export function magicForAccount(accountId: number): number {
  return MT_MAGIC_BASE + accountId;
}

export function commentForAccount(userId: number, accountId: number): string {
  return `Orion:u${userId}:a${accountId}`;
}

export function parseOwnerFromComment(comment?: string): { userId?: number; accountId?: number } {
  if (!comment) return {};
  const match = comment.match(/Orion:u(\d+):a(\d+)/);
  if (!match) return {};
  return { userId: Number(match[1]), accountId: Number(match[2]) };
}
