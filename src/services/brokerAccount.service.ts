import { Op } from 'sequelize';
import { accountResolver } from '../engine/AccountResolver';
import { BrokerId } from '../engine/engine.types';
import { BrokerAccount } from '../models';
import {
  BrokerAccountCredentialsInput,
  BrokerAccountPublicView,
  CreateBrokerAccountInput,
  UpdateBrokerAccountInput,
} from '../types';
import { magicForAccount } from '../engine/mtIdentity';
import { encryptSecret } from '../utils/crypto';

const SUPPORTED_BROKERS: BrokerId[] = ['binance', 'mt5', 'bybit'];
const UNSUPPORTED_BROKERS = new Set(['okx', 'oanda']);

function toPublicView(account: BrokerAccount): BrokerAccountPublicView {
  const credentialFields: string[] = [];
  if (account.apiKeyEnc) credentialFields.push('apiKey');
  if (account.apiSecretEnc) credentialFields.push('apiSecret');
  if (account.passphraseEnc) credentialFields.push('passphrase');

  return {
    id: account.id,
    userId: account.userId,
    brokerId: account.brokerId,
    accountName: account.accountName,
    accountType: account.accountType,
    environment: account.environment,
    externalRef: account.externalRef,
    status: account.status,
    isPrimary: account.isPrimary,
    lastCheckedAt: account.lastCheckedAt ? account.lastCheckedAt.toISOString() : null,
    lastError: account.lastError,
    meta: account.meta || {},
    hasCredentials: credentialFields.length > 0,
    credentialFields,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function assertBrokerId(brokerId: string): asserts brokerId is BrokerId {
  if (UNSUPPORTED_BROKERS.has(brokerId)) {
    throw new Error(`Broker ${brokerId} aún no tiene adaptador. Usa binance, bybit o mt5.`);
  }
  if (!SUPPORTED_BROKERS.includes(brokerId as BrokerId)) {
    throw new Error(`Broker no soportado: ${brokerId}`);
  }
}

function applyCredentials(
  input?: BrokerAccountCredentialsInput
): Partial<BrokerAccount> {
  if (!input) return {};
  const patch: Partial<BrokerAccount> = {};
  if (input.apiKey !== undefined) {
    patch.apiKeyEnc = input.apiKey ? encryptSecret(input.apiKey) : null;
  }
  if (input.apiSecret !== undefined) {
    patch.apiSecretEnc = input.apiSecret ? encryptSecret(input.apiSecret) : null;
  }
  if (input.passphrase !== undefined) {
    patch.passphraseEnc = input.passphrase ? encryptSecret(input.passphrase) : null;
  }
  return patch;
}

async function clearPrimaryForUser(userId: number, brokerId: string, exceptId?: number): Promise<void> {
  await BrokerAccount.update(
    { isPrimary: false },
    {
      where: {
        userId,
        brokerId,
        ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}),
      },
    }
  );
}

export class BrokerAccountService {
  async listUserAccounts(userId: number): Promise<BrokerAccountPublicView[]> {
    const accounts = await BrokerAccount.findAll({
      where: { userId },
      order: [
        ['isPrimary', 'DESC'],
        ['brokerId', 'ASC'],
        ['accountName', 'ASC'],
      ],
    });
    return accounts.map(toPublicView);
  }

  async getAccount(userId: number, accountId: number): Promise<BrokerAccountPublicView> {
    const account = await this.findOwnedAccount(userId, accountId);
    return toPublicView(account);
  }

  async createAccount(input: CreateBrokerAccountInput): Promise<BrokerAccountPublicView> {
    assertBrokerId(input.brokerId);
    if (input.isPrimary) await clearPrimaryForUser(input.userId, input.brokerId);

    const account = await BrokerAccount.create({
      userId: input.userId,
      brokerId: input.brokerId,
      accountName: input.accountName.trim(),
      accountType: input.accountType || (input.brokerId === 'mt5' ? 'live' : 'spot'),
      environment: input.environment || 'mainnet',
      externalRef: input.externalRef || null,
      status: 'pending',
      isPrimary: Boolean(input.isPrimary),
      meta: input.meta || {},
      ...applyCredentials(input.credentials),
    });

    if (account.brokerId === 'mt5') {
      await account.update({
        meta: { ...(account.meta || {}), magic: magicForAccount(account.id) },
      });
    }

    return toPublicView(account);
  }

  async updateAccount(
    userId: number,
    accountId: number,
    input: UpdateBrokerAccountInput
  ): Promise<BrokerAccountPublicView> {
    const account = await this.findOwnedAccount(userId, accountId);
    if (input.isPrimary) await clearPrimaryForUser(userId, account.brokerId, account.id);

    await account.update({
      ...(input.accountName !== undefined ? { accountName: input.accountName.trim() } : {}),
      ...(input.accountType !== undefined ? { accountType: input.accountType } : {}),
      ...(input.environment !== undefined ? { environment: input.environment } : {}),
      ...(input.externalRef !== undefined ? { externalRef: input.externalRef || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      ...(input.meta !== undefined ? { meta: input.meta } : {}),
      ...applyCredentials(input.credentials),
    });

    return toPublicView(account);
  }

  async deleteAccount(userId: number, accountId: number): Promise<void> {
    const account = await this.findOwnedAccount(userId, accountId);
    await account.destroy();
  }

  async setPrimary(userId: number, accountId: number): Promise<BrokerAccountPublicView> {
    const account = await this.findOwnedAccount(userId, accountId);
    await clearPrimaryForUser(userId, account.brokerId, account.id);
    await account.update({ isPrimary: true });
    return toPublicView(account);
  }

  async testConnection(userId: number, accountId: number) {
    const account = await this.findOwnedAccount(userId, accountId);

    if (account.status === 'disabled') {
      return this.applyConnectionResult(account, false, 'disabled', 'Cuenta deshabilitada.');
    }

    if (account.brokerId === 'mt5' && process.env.MT_ENABLED !== 'true') {
      return this.applyConnectionResult(
        account,
        false,
        'disabled',
        'MetaTrader deshabilitado (MT_ENABLED=false).'
      );
    }

    try {
      const { resolved, adapter } = await accountResolver.resolveAdapter({
        userId,
        brokerAccountId: accountId,
      });

      const connected = await adapter.isConnected();
      const hasCreds = Boolean(resolved.credentials.apiKey && resolved.credentials.apiSecret);

      let message: string;
      if (connected) {
        if (resolved.brokerId === 'binance' && !hasCreds) {
          message = 'API pública OK. Agrega API Key y Secret para operar en real.';
        } else if (resolved.brokerId === 'bybit' && !hasCreds) {
          message = 'API pública OK. Agrega credenciales Bybit para operar en real.';
        } else {
          message = 'Conexión verificada.';
        }
      } else {
        message = 'No se pudo verificar la conexión.';
      }

      return this.applyConnectionResult(
        account,
        connected,
        connected ? 'connected' : 'failed',
        message
      );
    } catch (err: any) {
      return this.applyConnectionResult(
        account,
        false,
        'failed',
        err.message || 'Error al verificar conexión'
      );
    }
  }

  private async applyConnectionResult(
    account: BrokerAccount,
    connected: boolean,
    status: string,
    message: string
  ) {
    await account.update({
      status: connected ? 'connected' : status === 'disabled' ? 'disabled' : 'error',
      lastCheckedAt: new Date(),
      lastError: connected ? null : message,
    });

    return {
      connected,
      status,
      message,
      account: toPublicView(account),
    };
  }

  private async findOwnedAccount(userId: number, accountId: number): Promise<BrokerAccount> {
    const account = await BrokerAccount.findOne({ where: { id: accountId, userId } });
    if (!account) throw new Error('Cuenta de broker no encontrada');
    return account;
  }
}

export const brokerAccountService = new BrokerAccountService();
