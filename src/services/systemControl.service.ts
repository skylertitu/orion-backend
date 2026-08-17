import sequelize from '../config/database';
import { isFirebaseAdminReady, isFirebaseAuthReady } from '../config/firebase';
import { LUCY_INTEGRATION } from '../integrations/lucy/lucy.pending';
import { metatraderService } from '../integrations/metatrader/mt.service';
import { tradingEngine } from '../engine/TradingEngine';
import { getWorkerInstance } from '../engine/workerRegistry';
import { binancePublicGet } from './binancePublic';
import { pingJupiter } from './jupiter.service';
import SystemControl, { SystemModuleId } from '../models/SystemControl';
import { BrokerAccount, Indicator } from '../models';
import { logger } from '../utils/logger';

export type { SystemModuleId };

export const SYSTEM_MODULES: Array<{
  id: SystemModuleId;
  name: string;
  description: string;
  href: string;
}> = [
  { id: 'trading', name: 'Motor de órdenes', description: 'Compras, ventas y cierre de posiciones', href: '/trading' },
  { id: 'worker', name: 'Worker automático', description: 'Ciclo de estrategias y señales', href: '/trading' },
  { id: 'lucy', name: 'Lucy IA', description: 'Chat, análisis y señales de Lucy', href: '/lucy' },
  { id: 'market', name: 'Mercado', description: 'Precios, velas y watchlist de Binance', href: '/mercado' },
  { id: 'mt5', name: 'MetaTrader 5', description: 'Puente con cuentas MT5', href: '/cuentas' },
  { id: 'indicators', name: 'Indicadores', description: 'Scripts sobre la gráfica', href: '/indicadores' },
  { id: 'accounts', name: 'Cuentas broker', description: 'Conexión Binance, Bybit y MT5 de usuarios', href: '/cuentas' },
  { id: 'jupiter', name: 'Jupiter Solana', description: 'Precios y rutas de swap en mercados Jupiter', href: '/trading?tab=jupiter' },
];

export type ModuleHealth = 'ok' | 'down' | 'pending' | 'paused';

export type SystemModuleStatus = {
  id: SystemModuleId;
  name: string;
  description: string;
  href: string;
  enabled: boolean;
  health: ModuleHealth;
  label: string;
  error?: string;
  detail?: string;
  note?: string | null;
};

let cache = new Map<SystemModuleId, boolean>();
let ready = false;

export async function ensureSystemControls(): Promise<void> {
  if (ready && cache.size === SYSTEM_MODULES.length) return;
  for (const mod of SYSTEM_MODULES) {
    const [row] = await SystemControl.findOrCreate({
      where: { id: mod.id },
      defaults: { id: mod.id, enabled: true },
    });
    cache.set(mod.id, row.enabled);
  }
  ready = true;
}

export async function isModuleEnabled(id: SystemModuleId): Promise<boolean> {
  await ensureSystemControls();
  return cache.get(id) !== false;
}

export async function setModuleEnabled(
  id: SystemModuleId,
  enabled: boolean,
  updatedBy?: number,
  note?: string
): Promise<boolean> {
  await ensureSystemControls();
  if (!SYSTEM_MODULES.some((m) => m.id === id)) {
    throw Object.assign(new Error('Módulo desconocido'), { status: 400 });
  }
  await SystemControl.upsert({
    id,
    enabled,
    updatedBy: updatedBy ?? null,
    note: note?.slice(0, 240) || null,
  });
  cache.set(id, enabled);

  if (id === 'worker') {
    const worker = getWorkerInstance() as { start?: () => void; stop?: () => void } | null;
    try {
      if (enabled) worker?.start?.();
      else worker?.stop?.();
    } catch (err) {
      logger.warn(`[system] No se pudo ${enabled ? 'iniciar' : 'detener'} el worker: ${(err as Error).message}`);
    }
  }

  return enabled;
}

function healthLabel(health: ModuleHealth, enabled: boolean): string {
  if (!enabled) return 'Apagado para usuarios';
  if (health === 'ok') return 'Funcionando';
  if (health === 'pending') return 'Pendiente';
  if (health === 'paused') return 'Pausado';
  return 'Con error';
}

export async function getSystemStatus(): Promise<{
  modules: SystemModuleStatus[];
  worker: Record<string, unknown> | null;
  brokers: Array<{ id: string; label: string; connected: boolean; enabled: boolean; message?: string; error?: string }>;
  extras: {
    database: boolean;
    firebaseAdmin: boolean;
    firebaseAuth: boolean;
  };
}> {
  await ensureSystemControls();

  let database = false;
  try {
    await sequelize.authenticate();
    database = true;
  } catch {
    database = false;
  }

  let marketOk = false;
  let marketError = '';
  try {
    await binancePublicGet('/ticker/price?symbol=BTCUSDT');
    marketOk = true;
  } catch (err) {
    marketError = err instanceof Error ? err.message : 'Binance no responde';
  }

  const worker = getWorkerInstance() as { getStatus?: () => Record<string, unknown> } | null;
  const workerStatus = worker?.getStatus?.() || null;
  const workerRunning = Boolean(workerStatus?.running);
  const workerErrors = Array.isArray(workerStatus?.errors) ? (workerStatus?.errors as string[]) : [];

  let brokers: Awaited<ReturnType<typeof tradingEngine.getBrokerStatuses>> = [];
  try {
    brokers = await tradingEngine.getBrokerStatuses();
  } catch (err) {
    brokers = [];
    logger.warn(`[system] Brokers: ${(err as Error).message}`);
  }

  const connectedBrokers = brokers.filter((b) => b.connected).length;
  const mt = brokers.find((b) => b.id === 'mt5');
  const mtEnabledEnv = process.env.MT_ENABLED === 'true';

  let accountsConnected = 0;
  try {
    accountsConnected = await BrokerAccount.count({ where: { status: 'connected' } });
  } catch {
    accountsConnected = 0;
  }

  let indicatorCount = 0;
  try {
    indicatorCount = await Indicator.count();
  } catch {
    indicatorCount = 0;
  }

  const jupiterPing = await pingJupiter();

  const rows = await SystemControl.findAll();
  const notes = new Map(rows.map((row) => [row.id, row.note]));
  const enabledOf = (id: SystemModuleId) => cache.get(id) !== false;

  const modules: SystemModuleStatus[] = SYSTEM_MODULES.map((mod) => {
    const enabled = enabledOf(mod.id);
    let health: ModuleHealth = 'ok';
    let error: string | undefined;
    let detail: string | undefined;

    if (mod.id === 'trading') {
      health = database && connectedBrokers > 0 ? 'ok' : connectedBrokers === 0 ? 'pending' : 'down';
      detail = `${connectedBrokers}/${brokers.length || 0} brokers responden`;
      if (!database) {
        health = 'down';
        error = 'Base de datos no disponible';
      }
    } else if (mod.id === 'worker') {
      health = workerRunning ? 'ok' : 'paused';
      detail = workerStatus
        ? `Ciclos ${workerStatus.cycleCount ?? 0} · WS ${workerStatus.wsConnected ? 'live' : 'off'}`
        : 'Worker no inicializado';
      if (workerErrors.length) error = workerErrors[workerErrors.length - 1];
    } else if (mod.id === 'lucy') {
      health = LUCY_INTEGRATION.pending || !LUCY_INTEGRATION.enabled ? 'pending' : 'ok';
      detail = LUCY_INTEGRATION.reason;
    } else if (mod.id === 'market') {
      health = marketOk ? 'ok' : 'down';
      detail = marketOk ? 'Binance público responde' : marketError;
      if (!marketOk) error = marketError;
    } else if (mod.id === 'mt5') {
      const connected = metatraderService.isConnected();
      health = !mtEnabledEnv ? 'paused' : connected ? 'ok' : 'down';
      detail = mt?.message || (mtEnabledEnv ? (connected ? 'Puente conectado' : 'MT_ENABLED pero sin conexión') : 'MT_ENABLED=false');
      if (mt?.error) error = mt.error;
    } else if (mod.id === 'indicators') {
      health = database ? 'ok' : 'down';
      detail = `${indicatorCount} scripts en base`;
    } else if (mod.id === 'accounts') {
      health = database ? 'ok' : 'down';
      detail = `${accountsConnected} cuentas conectadas`;
    } else if (mod.id === 'jupiter') {
      health = jupiterPing.ok ? 'ok' : jupiterPing.needsKey ? 'pending' : 'down';
      detail = jupiterPing.detail;
      if (!jupiterPing.ok) error = jupiterPing.error;
    }

    if (!enabled && health === 'ok') health = 'paused';

    return {
      id: mod.id,
      name: mod.name,
      description: mod.description,
      href: mod.href,
      enabled,
      health: enabled ? health : 'paused',
      label: healthLabel(enabled ? health : 'paused', enabled),
      error,
      detail,
      note: notes.get(mod.id) || null,
    };
  });

  return {
    modules,
    worker: workerStatus,
    brokers,
    extras: {
      database,
      firebaseAdmin: isFirebaseAdminReady(),
      firebaseAuth: isFirebaseAuthReady(),
    },
  };
}
