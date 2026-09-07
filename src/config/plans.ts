import { isStaffRole } from '../utils/roles';

/**
 * Producto por secciones de pago:
 * - free: Mercado + Lucy chat (cupo gratis)
 * - builder: Indicadores (librería + editor)
 * - signals: Señales de Lucy + chat Lucy sin límite de ayuda
 * - analyst: Trading manual + brokers (+ señales)
 *
 * Lucy chat es gratis hasta cierto punto.
 * Si Lucy se usa para trading, hace falta plan Señales o Analista.
 */
export const USER_PLANS = ['free', 'builder', 'signals', 'analyst'] as const;
export type UserPlan = (typeof USER_PLANS)[number];

export const DEFAULT_USER_PLAN: UserPlan = 'free';

export type PlanCapability =
  | 'market'
  | 'indicators_library'
  | 'indicators_editor'
  | 'lucy_chat'
  | 'lucy_signals'
  | 'lucy_control'
  | 'broker_accounts'
  | 'manual_orders'
  | 'wallets'
  | 'jupiter_execute'
  | 'strategies_auto';

export const PLAN_LABELS: Record<UserPlan, string> = {
  free: 'Gratis',
  builder: 'Indicadores',
  signals: 'Señales',
  analyst: 'Analista',
};

export const PLAN_BLURBS: Record<UserPlan, string> = {
  free: 'Mercado y Lucy chat con cupo gratis. Trading con Lucy pide un plan.',
  builder: 'Creas y editas indicadores. Incluye Mercado y Lucy chat.',
  signals: 'Feed de señales de Lucy y chat sin límite de ayuda.',
  analyst: 'Órdenes manuales, estrategias, Jupiter (Solana), brokers y señales.',
};

/** Cupo diario de mensajes Lucy en plan free (y planes sin señales). */
export const LUCY_FREE_DAILY_MESSAGES = 10;

const PLAN_CAPABILITIES: Record<UserPlan, PlanCapability[]> = {
  free: ['market', 'lucy_chat'],
  builder: ['market', 'indicators_library', 'indicators_editor', 'lucy_chat'],
  signals: ['market', 'indicators_library', 'lucy_chat', 'lucy_signals', 'broker_accounts', 'wallets'],
  analyst: [
    'market',
    'indicators_library',
    'lucy_chat',
    'lucy_signals',
    'broker_accounts',
    'manual_orders',
    'wallets',
    'strategies_auto',
    'jupiter_execute',
  ],
};

const ADMIN_CAPABILITIES: PlanCapability[] = [
  'market',
  'indicators_library',
  'indicators_editor',
  'lucy_chat',
  'lucy_signals',
  'lucy_control',
  'broker_accounts',
  'manual_orders',
  'wallets',
  'jupiter_execute',
  'strategies_auto',
];

const LEGACY_PLAN_MAP: Record<string, UserPlan> = {
  // planes viejos → nuevos
  builder: 'builder',
  signals: 'signals',
  analyst: 'analyst',
  free: 'free',
};

export function isUserPlan(value: unknown): value is UserPlan {
  return typeof value === 'string' && (USER_PLANS as readonly string[]).includes(value);
}

export function normalizePlan(role: string | null | undefined, plan: string | null | undefined): UserPlan | null {
  if (isStaffRole(role)) return null;
  if (isUserPlan(plan)) return plan;
  if (typeof plan === 'string' && LEGACY_PLAN_MAP[plan]) return LEGACY_PLAN_MAP[plan];
  return DEFAULT_USER_PLAN;
}

export function hasCapability(
  role: string | null | undefined,
  plan: string | null | undefined,
  capability: PlanCapability
): boolean {
  if (isStaffRole(role)) return ADMIN_CAPABILITIES.includes(capability);
  const resolved = normalizePlan(role, plan);
  if (!resolved) return false;
  return PLAN_CAPABILITIES[resolved].includes(capability);
}

export function defaultPlanForRole(role: string): UserPlan | null {
  return isStaffRole(role) ? null : DEFAULT_USER_PLAN;
}

export const CAPABILITY_DENIED: Partial<Record<PlanCapability, string>> = {
  wallets: 'Conecta Phantom o Solflare desde Cuentas (plan Señales o Analista).',
  jupiter_execute: 'Jupiter (swap Solana) va en el plan Analista.',
  strategies_auto: 'Las estrategias del worker van en el plan Analista.',
};
