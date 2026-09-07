import Stripe from 'stripe';
import { isUserPlan, type UserPlan } from '../config/plans';
import { PlanRequest, User } from '../models';
import { logger } from '../utils/logger';

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function stripePriceIdForPlan(plan: UserPlan): string | null {
  const map: Record<UserPlan, string | undefined> = {
    free: undefined,
    builder: process.env.STRIPE_PRICE_BUILDER,
    signals: process.env.STRIPE_PRICE_SIGNALS,
    analyst: process.env.STRIPE_PRICE_ANALYST,
  };
  const id = map[plan]?.trim();
  return id || null;
}

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  }
  return stripeClient;
}

export function assertBillablePlan(plan: string): UserPlan {
  if (!isUserPlan(plan) || plan === 'free') {
    throw new Error('Elige un plan de pago (Indicadores, Señales o Analista)');
  }
  return plan;
}

/** Activa el plan del usuario tras checkout.session.completed / paid. */
export async function applyCheckoutSessionPaid(session: Stripe.Checkout.Session): Promise<{
  userId: number;
  plan: UserPlan;
} | null> {
  const meta = session.metadata || {};
  const userId = Number(meta.userId || 0);
  const planRaw = String(meta.plan || '');
  if (!userId || !isUserPlan(planRaw) || planRaw === 'free') {
    logger.warn(`[billing] webhook sin metadata válida session=${session.id}`);
    return null;
  }
  const plan = planRaw as UserPlan;
  const user = await User.findByPk(userId);
  if (!user) {
    logger.warn(`[billing] webhook user ${userId} no encontrado`);
    return null;
  }

  await user.update({ plan });

  const requestId = Number(meta.planRequestId || 0);
  if (requestId) {
    await PlanRequest.update(
      { status: 'fulfilled', stripeSessionId: session.id },
      { where: { id: requestId, userId } }
    );
  } else {
    await PlanRequest.update(
      { status: 'fulfilled', stripeSessionId: session.id },
      { where: { userId, requestedPlan: plan, status: 'pending' } }
    );
  }

  logger.info(`[billing] plan activado user=${userId} plan=${plan} session=${session.id}`);
  return { userId, plan };
}
