import { Op } from 'sequelize';
import { BrokerAccount } from '../models';
import { decryptSecret } from '../utils/crypto';
import { BinanceAdapter } from './adapters/BinanceAdapter';
import { BybitAdapter } from './adapters/BybitAdapter';
import { MT5Adapter } from './adapters/MT5Adapter';
import { ResolvedBrokerAccount, ResolveAccountOptions } from './account.types';
import { executionModeOf } from './executionMode';
import { BrokerId } from './engine.types';
import { IBrokerAdapter } from './IBrokerAdapter';

function decryptFromAccount(account: BrokerAccount) {
  return {
    apiKey: account.apiKeyEnc ? decryptSecret(account.apiKeyEnc) : '',
    apiSecret: account.apiSecretEnc ? decryptSecret(account.apiSecretEnc) : '',
    passphrase: account.passphraseEnc ? decryptSecret(account.passphraseEnc) : '',
    accessToken: '',
    refreshToken: '',
  };
}

function toResolved(account: BrokerAccount): ResolvedBrokerAccount {
  return {
    accountId: account.id,
    userId: account.userId,
    brokerId: account.brokerId as BrokerId,
    accountName: account.accountName,
    accountType: account.accountType,
    environment: account.environment,
    executionMode: executionModeOf(account.meta, account.environment),
    externalRef: account.externalRef,
    status: account.status,
    meta: account.meta || {},
    credentials: decryptFromAccount(account),
  };
}

export class AccountResolver {
  async resolve(options: ResolveAccountOptions): Promise<ResolvedBrokerAccount> {
    const { userId, brokerAccountId, brokerId, requireActive = false } = options;

    if (brokerAccountId) {
      const account = await BrokerAccount.findOne({ where: { id: brokerAccountId, userId } });
      if (!account) throw new Error('Cuenta de broker no encontrada para este usuario');
      if (requireActive && account.status === 'disabled') {
        throw new Error('La cuenta de broker está deshabilitada');
      }
      if (brokerId && account.brokerId !== brokerId) {
        throw new Error(`La cuenta no pertenece al broker ${brokerId}`);
      }
      return toResolved(account);
    }

    if (!brokerId) throw new Error('Debes indicar brokerAccountId o brokerId');

    const account = await BrokerAccount.findOne({
      where: {
        userId,
        brokerId,
        ...(requireActive ? { status: { [Op.ne]: 'disabled' } } : {}),
      },
      order: [
        ['isPrimary', 'DESC'],
        ['updatedAt', 'DESC'],
      ],
    });

    if (!account) {
      throw new Error(`No hay cuenta conectada de ${brokerId} para este usuario`);
    }

    return toResolved(account);
  }

  createAdapter(resolved: ResolvedBrokerAccount): IBrokerAdapter {
    switch (resolved.brokerId) {
      case 'binance':
        return new BinanceAdapter({
          apiKey: resolved.credentials.apiKey,
          apiSecret: resolved.credentials.apiSecret,
          environment: resolved.environment,
        });
      case 'bybit':
        return new BybitAdapter({
          apiKey: resolved.credentials.apiKey,
          apiSecret: resolved.credentials.apiSecret,
          environment: resolved.environment,
          accountType: resolved.accountType,
        });
      case 'mt5':
        return new MT5Adapter({
          userId: resolved.userId,
          accountId: resolved.accountId,
        });
      default:
        throw new Error(`Adaptador no implementado para ${resolved.brokerId}`);
    }
  }

  createGlobalAdapter(brokerId: BrokerId): IBrokerAdapter {
    switch (brokerId) {
      case 'binance':
        return new BinanceAdapter();
      case 'bybit':
        return new BybitAdapter();
      case 'mt5':
        return new MT5Adapter();
      default:
        throw new Error(`Adaptador no implementado para ${brokerId}`);
    }
  }

  async resolveAdapter(options: ResolveAccountOptions) {
    const resolved = await this.resolve(options);
    return { resolved, adapter: this.createAdapter(resolved) };
  }
}

export const accountResolver = new AccountResolver();
