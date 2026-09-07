import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { PlanRequest, User } from '../models';
import { ApiResponse } from '../types';
import { TokenPayload } from '../utils/jwt';
import { isUserPlan, PLAN_LABELS, type UserPlan } from '../config/plans';
import {
  assertBillablePlan,
  getStripe,
  isStripeConfigured,
  stripePriceIdForPlan,
  applyCheckoutSessionPaid,
} from '../services/billing.service';
import { logger } from '../utils/logger';
import Stripe from 'stripe';

type Authed = Request & { user?: TokenPayload };

function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function billingStatus(_req: Request, res: Response) {
  const response: ApiResponse = {
    success: true,
    data: {
      stripeConfigured: isStripeConfigured(),
      prices: {
        builder: Boolean(process.env.STRIPE_PRICE_BUILDER?.trim()),
        signals: Boolean(process.env.STRIPE_PRICE_SIGNALS?.trim()),
        analyst: Boolean(process.env.STRIPE_PRICE_ANALYST?.trim()),
      },
      message: isStripeConfigured()
        ? 'Checkout Stripe disponible para planes con price id.'
        : 'Stripe no configurado. Las solicitudes quedan para el administrador.',
    },
  };
  res.json(response);
}

export async function createPlanRequest(req: Request, res: Response) {
  const response: ApiResponse = { success: true };
  try {
    const userId = (req as Authed).user?.id;
    if (!userId) {
      response.success = false;
      response.error = 'No autenticado';
      return res.status(401).json(response);
    }

    const plan = assertBillablePlan(String(req.body?.plan || ''));
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 400) : null;

    await PlanRequest.update(
      { status: 'cancelled' },
      { where: { userId, status: 'pending', requestedPlan: { [Op.ne]: plan } } }
    );

    const [row] = await PlanRequest.findOrCreate({
      where: { userId, requestedPlan: plan, status: 'pending' },
      defaults: { userId, requestedPlan: plan, status: 'pending', note },
    });
    if (note && row.note !== note) await row.update({ note });

    response.data = {
      id: row.id,
      plan,
      label: PLAN_LABELS[plan],
      status: row.status,
      stripeConfigured: isStripeConfigured(),
    };
    response.message = `Solicitud de ${PLAN_LABELS[plan]} registrada`;
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err?.message || 'No se pudo registrar la solicitud';
    res.status(400).json(response);
  }
}

export async function createCheckoutSession(req: Request, res: Response) {
  const response: ApiResponse = { success: true };
  try {
    const userId = (req as Authed).user?.id;
    const email = (req as Authed).user?.email;
    if (!userId) {
      response.success = false;
      response.error = 'No autenticado';
      return res.status(401).json(response);
    }

    const plan = assertBillablePlan(String(req.body?.plan || ''));
    const stripe = getStripe();
    const priceId = stripePriceIdForPlan(plan);

    if (!stripe || !priceId) {
      const [row] = await PlanRequest.findOrCreate({
        where: { userId, requestedPlan: plan, status: 'pending' },
        defaults: { userId, requestedPlan: plan, status: 'pending' },
      });
      response.data = {
        mode: 'interest',
        id: row.id,
        plan,
        label: PLAN_LABELS[plan],
        stripeConfigured: Boolean(stripe),
        priceConfigured: Boolean(priceId),
      };
      response.message = stripe
        ? `Falta STRIPE_PRICE_${plan.toUpperCase()} en el servidor. Solicitud registrada.`
        : `Solicitud de ${PLAN_LABELS[plan]} registrada (Stripe no configurado).`;
      return res.json(response);
    }

    const [interest] = await PlanRequest.findOrCreate({
      where: { userId, requestedPlan: plan, status: 'pending' },
      defaults: { userId, requestedPlan: plan, status: 'pending' },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl()}/planes?checkout=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/planes?checkout=cancel`,
      client_reference_id: String(userId),
      metadata: {
        userId: String(userId),
        plan,
        planRequestId: String(interest.id),
      },
    });

    await interest.update({ stripeSessionId: session.id });

    response.data = {
      mode: 'stripe',
      url: session.url,
      sessionId: session.id,
      plan,
    };
    res.json(response);
  } catch (err: any) {
    logger.warn(`[billing] checkout: ${err?.message || err}`);
    response.success = false;
    response.error = err?.message || 'No se pudo abrir el checkout';
    res.status(400).json(response);
  }
}

export async function myPlanRequests(req: Request, res: Response) {
  const response: ApiResponse = { success: true };
  try {
    const userId = (req as Authed).user?.id;
    if (!userId) {
      response.success = false;
      response.error = 'No autenticado';
      return res.status(401).json(response);
    }
    const rows = await PlanRequest.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });
    response.data = rows;
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err?.message || 'Error';
    res.status(500).json(response);
  }
}

export async function listPlanRequests(_req: Request, res: Response) {
  const response: ApiResponse = { success: true };
  try {
    const rows = await PlanRequest.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']],
      limit: 100,
    });
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = userIds.length
      ? await User.findAll({
          where: { id: userIds },
          attributes: ['id', 'username', 'email', 'plan', 'role'],
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    response.data = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      requestedPlan: r.requestedPlan,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt,
      user: byId.get(r.userId)
        ? {
            id: byId.get(r.userId)!.id,
            username: byId.get(r.userId)!.username,
            email: byId.get(r.userId)!.email,
            plan: byId.get(r.userId)!.plan,
          }
        : null,
    }));
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err?.message || 'Error';
    res.status(500).json(response);
  }
}

export async function fulfillPlanRequest(req: Request, res: Response) {
  const response: ApiResponse = { success: true };
  try {
    const id = Number(req.params.id);
    const row = await PlanRequest.findByPk(id);
    if (!row || row.status !== 'pending') {
      response.success = false;
      response.error = 'Solicitud no encontrada';
      return res.status(404).json(response);
    }
    if (!isUserPlan(row.requestedPlan)) {
      response.success = false;
      response.error = 'Plan inválido';
      return res.status(400).json(response);
    }
    const user = await User.findByPk(row.userId);
    if (!user) {
      response.success = false;
      response.error = 'Usuario no encontrado';
      return res.status(404).json(response);
    }
    await user.update({ plan: row.requestedPlan });
    await row.update({ status: 'fulfilled' });
    response.data = {
      requestId: row.id,
      userId: user.id,
      plan: row.requestedPlan as UserPlan,
    };
    response.message = `${user.username} → ${PLAN_LABELS[row.requestedPlan as UserPlan]}`;
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err?.message || 'Error';
    res.status(500).json(response);
  }
}

/** Confirma un checkout desde el frontend (útil sin webhook en local). */
export async function confirmCheckoutSession(req: Request, res: Response) {
  const response: ApiResponse = { success: true };
  try {
    const userId = (req as Authed).user?.id;
    if (!userId) {
      response.success = false;
      response.error = 'No autenticado';
      return res.status(401).json(response);
    }

    const sessionId = String(req.body?.sessionId || req.body?.session_id || '').trim();
    if (!sessionId.startsWith('cs_')) {
      response.success = false;
      response.error = 'sessionId de Stripe inválido';
      return res.status(400).json(response);
    }

    const stripe = getStripe();
    if (!stripe) {
      response.success = false;
      response.error = 'Stripe no configurado';
      return res.status(503).json(response);
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metaUser = Number(session.metadata?.userId || session.client_reference_id || 0);
    if (metaUser !== userId) {
      response.success = false;
      response.error = 'Esta sesión de pago no pertenece a tu cuenta';
      return res.status(403).json(response);
    }

    const paid =
      session.payment_status === 'paid' ||
      session.status === 'complete' ||
      session.payment_status === 'no_payment_required';

    if (!paid) {
      response.success = false;
      response.error = `Pago aún no confirmado (${session.payment_status || session.status})`;
      response.data = { status: session.status, payment_status: session.payment_status };
      return res.status(402).json(response);
    }

    const applied = await applyCheckoutSessionPaid(session);
    const user = await User.findByPk(userId, { attributes: ['id', 'plan', 'email', 'username'] });
    response.data = {
      applied: Boolean(applied),
      plan: user?.plan || applied?.plan || session.metadata?.plan,
      sessionId: session.id,
    };
    response.message = applied
      ? `Plan ${PLAN_LABELS[(applied.plan as UserPlan)] || applied.plan} activado`
      : 'Sesión verificada';
    res.json(response);
  } catch (err: any) {
    logger.warn(`[billing] confirm: ${err?.message || err}`);
    response.success = false;
    response.error = err?.message || 'No se pudo confirmar el pago';
    res.status(400).json(response);
  }
}

/** Stripe webhook — body debe ser Buffer (express.raw). */
export async function stripeWebhook(req: Request, res: Response) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    return res.status(503).json({ success: false, error: 'Webhook Stripe no configurado' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    return res.status(400).json({ success: false, error: 'Falta stripe-signature' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err: any) {
    logger.warn(`[billing] firma webhook inválida: ${err?.message || err}`);
    return res.status(400).json({ success: false, error: 'Firma inválida' });
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid' || session.status === 'complete') {
        await applyCheckoutSessionPaid(session);
      }
    }
    res.json({ received: true });
  } catch (err: any) {
    logger.error(`[billing] webhook handler: ${err?.message || err}`);
    res.status(500).json({ success: false, error: 'Error procesando webhook' });
  }
}
