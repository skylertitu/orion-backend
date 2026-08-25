import { isStaffRole } from '../utils/roles';

export const USER_PLANS = ['analyst', 'signals', 'builder'] as const;
export type UserPlan = (typeof USER_PLANS)[number];

export const DEFAULT_USER_PLAN: UserPlan = 'builder';

export type PlanCapability =
  | 'market'
  | 'indicators_library'
  | 'indicators_editor'
  | 'lucy_signals'
  | 'lucy_control'
  | 'broker_accounts'
  | 'manual_orders'
  | 'wallets'
  | 'jupiter_execute'
  | 'strategies_auto';

export const PLAN_LABELS: Record<UserPlan, string> = {
  analyst: 'Analista',
  signals: 'Señales',
  builder: 'Builder',
};

const PLAN_CAPABILITIES: Record<UserPlan, PlanCapability[]> = {
  analyst: ['market', 'indicators_library', 'lucy_signals', 'broker_accounts', 'manual_orders', 'wallets'],
  signals: ['market', 'indicators_library', 'lucy_signals', 'broker_accounts', 'wallets'],
  builder: ['market', 'indicators_library', 'indicators_editor', 'lucy_signals', 'broker_accounts', 'wallets'],
};

const ADMIN_CAPABILITIES: PlanCapability[] = [
  'market',
  'indicators_library',
  'indicators_editor',
  'lucy_signals',
  'lucy_control',
  'broker_accounts',
  'manual_orders',
  'wallets',
  'jupiter_execute',
  'strategies_auto',
];

export function isUserPlan(value: unknown): value is UserPlan {
  return typeof value === 'string' && (USER_PLANS as readonly string[]).includes(value);
}

export function normalizePlan(role: string | null | undefined, plan: string | null | undefined): UserPlan | null {
  if (isStaffRole(role)) return null;
  return isUserPlan(plan) ? plan : DEFAULT_USER_PLAN;
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
  wallets: 'Conecta Phantom o Solflare desde Cuentas.',
  jupiter_execute: 'Jupiter lo opera el administrador con su wallet.',
  lucy_control: 'Lucy autoejecuta solo para el administrador.',
  lucy_signals: 'Las señales de Lucy van en el plan Señales.',
  broker_accounts: 'Conecta tu broker desde Cuentas.',
  manual_orders: 'Las órdenes manuales son del plan Analista o del administrador.',
  indicators_editor: 'Crear indicadores es del plan Builder.',
  indicators_library: 'La librería de indicadores es del plan Analista o Builder.',
  strategies_auto: 'El worker automático solo lo usa el administrador.',
};
