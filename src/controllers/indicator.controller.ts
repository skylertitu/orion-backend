import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { col, fn, literal, Op } from 'sequelize';
import { Indicator, IndicatorBlock, User } from '../models';
import { ApiResponse } from '../types';

const MAX_SCRIPTS = 40;
const MAX_SOURCE = 80_000;

function tokenUser(req: Request): { id: number; role?: string } {
  return (req as Request & { user?: { id: number; role?: string } }).user || { id: 0 };
}

function hashSource(source: string): string {
  return createHash('sha256').update(source.trim()).digest('hex');
}

function publicRow(row: Indicator) {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    source: row.source,
    sourceHash: row.sourceHash,
    category: row.category || 'custom',
    enabled: row.enabled && !row.blocked,
    blocked: row.blocked,
  };
}

function fail(res: Response, response: ApiResponse, message: string, status = 400) {
  response.success = false;
  response.error = message;
  return res.status(status).json(response);
}

function normalizeIncoming(raw: unknown): Array<{
  clientId: string;
  name: string;
  source: string;
  enabled: boolean;
  category: string;
}> {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(['trend', 'oscillator', 'sessions', 'volume', 'custom']);
  const out: Array<{ clientId: string; name: string; source: string; enabled: boolean; category: string }> = [];
  for (const item of raw.slice(0, MAX_SCRIPTS)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const source = typeof row.source === 'string' ? row.source : '';
    if (!source || source.length > MAX_SOURCE) continue;
    const clientId =
      typeof row.clientId === 'string' && row.clientId.trim()
        ? row.clientId.trim().slice(0, 80)
        : typeof row.id === 'string' && row.id.trim()
          ? row.id.trim().slice(0, 80)
          : '';
    if (!clientId) continue;
    const categoryRaw = typeof row.category === 'string' ? row.category : 'custom';
    out.push({
      clientId,
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim().slice(0, 120) : 'Indicador',
      source,
      enabled: row.enabled !== false,
      category: allowed.has(categoryRaw) ? categoryRaw : 'custom',
    });
  }
  return out;
}

export const listMine = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  const userId = tokenUser(req).id;
  const rows = await Indicator.findAll({ where: { userId }, order: [['id', 'ASC']] });
  response.data = rows.map(publicRow);
  res.json(response);
};

export const saveMine = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  const userId = tokenUser(req).id;
  const incoming = normalizeIncoming(req.body?.scripts);
  const hashes = [...new Set(incoming.map((s) => hashSource(s.source)))];
  const blocks = hashes.length
    ? await IndicatorBlock.findAll({ where: { sourceHash: { [Op.in]: hashes } } })
    : [];
  const blockedSet = new Set(blocks.map((b) => b.sourceHash));

  const keepIds = incoming.map((s) => s.clientId);
  if (!keepIds.length) {
    await Indicator.destroy({ where: { userId } });
    response.data = [];
    return res.json(response);
  }

  await Indicator.destroy({
    where: { userId, clientId: { [Op.notIn]: keepIds } },
  });

  for (const item of incoming) {
    const sourceHash = hashSource(item.source);
    const blocked = blockedSet.has(sourceHash);
    const payload = {
      name: item.name,
      source: item.source,
      sourceHash,
      category: item.category,
      enabled: blocked ? false : item.enabled,
      blocked,
    };
    const existing = await Indicator.findOne({ where: { userId, clientId: item.clientId } });
    if (existing) await existing.update(payload);
    else {
      await Indicator.create({
        userId,
        clientId: item.clientId,
        ...payload,
      });
    }
  }

  const rows = await Indicator.findAll({ where: { userId }, order: [['id', 'ASC']] });
  response.data = rows.map(publicRow);
  res.json(response);
};

export const listPopular = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  const userId = tokenUser(req).id;
  const blocked = await IndicatorBlock.findAll({ attributes: ['sourceHash'] });
  const blockedSet = blocked.map((b) => b.sourceHash);

  const rows = await Indicator.findAll({
    attributes: [
      'sourceHash',
      [fn('MIN', col('name')), 'name'],
      [fn('MIN', col('source')), 'source'],
      [fn('MIN', col('category')), 'category'],
      [fn('COUNT', fn('DISTINCT', col('userId'))), 'users'],
      [fn('SUM', literal('CASE WHEN enabled THEN 1 ELSE 0 END')), 'inUse'],
    ],
    where: {
      ...(blockedSet.length ? { sourceHash: { [Op.notIn]: blockedSet } } : {}),
      userId: { [Op.ne]: userId },
    },
    group: ['sourceHash'],
    order: [
      [fn('SUM', literal('CASE WHEN enabled THEN 1 ELSE 0 END')), 'DESC'],
      [fn('COUNT', fn('DISTINCT', col('userId'))), 'DESC'],
    ],
    limit: 24,
    raw: true,
  });

  response.data = (rows as unknown as Array<Record<string, unknown>>).map((row) => ({
    sourceHash: row.sourceHash,
    name: row.name,
    source: row.source,
    category: row.category || 'custom',
    users: Number(row.users || 0),
    inUse: Number(row.inUse || 0),
  }));
  res.json(response);
};

export const clonePopular = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  const userId = tokenUser(req).id;
  const sourceHash = typeof req.body?.sourceHash === 'string' ? req.body.sourceHash : '';
  if (!sourceHash) return fail(res, response, 'Indicador no válido');

  const blocked = await IndicatorBlock.findByPk(sourceHash);
  if (blocked) return fail(res, response, 'Este indicador está bloqueado', 403);

  const sample = await Indicator.findOne({ where: { sourceHash } });
  if (!sample) return fail(res, response, 'No se encontró el indicador', 404);

  const clientId = `script_${Date.now().toString(36)}`;
  const created = await Indicator.create({
    userId,
    clientId,
    name: sample.name,
    source: sample.source,
    sourceHash,
    category: sample.category || 'custom',
    enabled: true,
    blocked: false,
  });
  response.data = publicRow(created);
  res.status(201).json(response);
};

export const listInUse = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  const rows = await Indicator.findAll({
    where: { enabled: true },
    include: [{ model: User, as: 'user', attributes: ['id', 'username'] }],
    order: [['updatedAt', 'DESC']],
    limit: 80,
  });
  response.data = rows.map((row) => {
    const user = (row as Indicator & { user?: { id: number; username: string } }).user;
    return {
      ...publicRow(row),
      userId: row.userId,
      username: user?.username || `user-${row.userId}`,
    };
  });
  res.json(response);
};

export const blockIndicator = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  const adminId = tokenUser(req).id;
  const rawHash = typeof req.body?.sourceHash === 'string' ? req.body.sourceHash : '';
  const source = typeof req.body?.source === 'string' ? req.body.source : '';
  const sourceHash = rawHash.length === 64 ? rawHash : source ? hashSource(source) : '';
  const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : 'Indicador';
  if (!sourceHash) return fail(res, response, 'Indicador no válido');

  await IndicatorBlock.upsert({ sourceHash, name, blockedBy: adminId });
  await Indicator.update({ blocked: true, enabled: false }, { where: { sourceHash } });
  response.data = { sourceHash, blocked: true };
  res.json(response);
};

export const unblockIndicator = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  const sourceHash = typeof req.body?.sourceHash === 'string' ? req.body.sourceHash : '';
  if (!sourceHash) return fail(res, response, 'Indicador no válido');

  await IndicatorBlock.destroy({ where: { sourceHash } });
  await Indicator.update({ blocked: false }, { where: { sourceHash } });
  response.data = { sourceHash, blocked: false };
  res.json(response);
};
