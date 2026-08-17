import fs from 'fs';
import path from 'path';
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { logger } from '../utils/logger';

function loadServiceAccount(): ServiceAccount | string | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      return JSON.parse(json) as ServiceAccount;
    } catch {
      logger.error('[Firebase] FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido');
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolved)) {
      logger.error(`[Firebase] No se encontró la cuenta de servicio en ${resolved}`);
      return null;
    }
    return resolved;
  }

  return null;
}

let authReady = false;

export function isFirebaseAdminReady(): boolean {
  return getApps().length > 0;
}

export function isFirebaseAuthReady(): boolean {
  return authReady;
}

async function probeAuthentication(): Promise<void> {
  try {
    await getAuth().listUsers(1);
    authReady = true;
    logger.info('[Firebase] Authentication habilitada en el proyecto');
  } catch (err: unknown) {
    authReady = false;
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('CONFIGURATION_NOT_FOUND') ||
      message.includes('no configuration corresponding')
    ) {
      logger.warn(
        '[Firebase] Authentication no está activada. En Firebase Console: Authentication → Get started → Google. Sin eso el botón de Google no podrá verificar usuarios.'
      );
      return;
    }
    logger.warn(`[Firebase] No se pudo comprobar Authentication: ${message}`);
  }
}

export async function initFirebaseAdmin(): Promise<boolean> {
  if (getApps().length > 0) {
    await probeAuthentication();
    return true;
  }

  const account = loadServiceAccount();
  if (!account) {
    logger.warn('[Firebase] Sin credenciales. El login con Google queda deshabilitado.');
    return false;
  }

  initializeApp({
    credential: cert(account),
  });
  logger.info('[Firebase] Admin SDK inicializado');
  await probeAuthentication();
  return true;
}

export async function verifyFirebaseIdToken(idToken: string) {
  if (!isFirebaseAdminReady()) {
    const ok = await initFirebaseAdmin();
    if (!ok) {
      const err = new Error('Firebase no está configurado en el servidor');
      (err as { status?: number }).status = 503;
      throw err;
    }
  }
  if (!authReady) {
    await probeAuthentication();
  }
  try {
    return await getAuth().verifyIdToken(idToken);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('CONFIGURATION_NOT_FOUND') ||
      message.includes('no configuration corresponding')
    ) {
      logger.error('[Firebase] verifyIdToken: Authentication no está activada en el proyecto');
      const e = new Error(
        'Firebase Authentication no está activada. Activa Authentication → Google en la consola de Firebase.'
      );
      (e as { status?: number }).status = 503;
      throw e;
    }
    logger.error(`[Firebase] verifyIdToken falló: ${message}`);
    throw err;
  }
}

export async function syncFirebasePassword(uid: string, password: string): Promise<void> {
  if (!uid || !password) return;
  if (!isFirebaseAdminReady()) {
    const ok = await initFirebaseAdmin();
    if (!ok) return;
  }
  try {
    await getAuth().updateUser(uid, { password });
    logger.info(`[auth] Contraseña sincronizada en Firebase uid=${uid}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[auth] No se pudo sincronizar la contraseña en Firebase uid=${uid}: ${message}`);
  }
}
