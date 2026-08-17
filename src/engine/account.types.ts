import { BrokerId } from './engine.types';
import { BrokerAccountType, BrokerEnvironment } from '../types';

export interface DecryptedCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  accessToken: string;
  refreshToken: string;
}

export interface ResolvedBrokerAccount {
  accountId: number;
  userId: number;
  brokerId: BrokerId;
  accountName: string;
  accountType: BrokerAccountType;
  environment: BrokerEnvironment;
  externalRef: string | null;
  status: string;
  meta: Record<string, unknown>;
  credentials: DecryptedCredentials;
}

export interface ResolveAccountOptions {
  userId: number;
  brokerAccountId?: number;
  brokerId?: BrokerId;
  requireActive?: boolean;
}
