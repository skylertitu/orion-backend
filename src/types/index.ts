export interface UserAttributes {
  id?: number;
  username: string;
  email: string;
  password: string;
  firebaseUid?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  country?: string | null;
  language?: string | null;
  timezone?: string | null;
  avatar?: string | null;
  termsAccepted?: boolean;
  emailVerified?: boolean;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  lastLoginAt?: Date | null;
  balance?: number;
  role?: 'user' | 'admin' | 'superadmin';
  plan?: string | null;
  sessionVersion?: number;
  blocked?: boolean;
  blockedReason?: string | null;
  blockedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StrategyAttributes {
  id?: number;
  userId: number;
  name: string;
  description?: string;
  config: object;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export type BrokerAccountStatus = 'pending' | 'connected' | 'error' | 'disabled';
export type BrokerAccountType = 'spot' | 'futures' | 'margin' | 'demo' | 'live';
export type BrokerEnvironment = 'mainnet' | 'testnet';

export interface BrokerAccountAttributes {
  id?: number;
  userId: number;
  brokerId: string;
  accountName: string;
  accountType: BrokerAccountType;
  environment: BrokerEnvironment;
  externalRef?: string | null;
  status: BrokerAccountStatus;
  isPrimary: boolean;
  lastCheckedAt?: Date | null;
  lastError?: string | null;
  meta?: Record<string, unknown>;
  apiKeyEnc?: string | null;
  apiSecretEnc?: string | null;
  passphraseEnc?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BrokerAccountCredentialsInput {
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
}

export interface CreateBrokerAccountInput {
  userId: number;
  brokerId: string;
  accountName: string;
  accountType?: BrokerAccountType;
  environment?: BrokerEnvironment;
  externalRef?: string;
  isPrimary?: boolean;
  meta?: Record<string, unknown>;
  credentials?: BrokerAccountCredentialsInput;
}

export interface UpdateBrokerAccountInput {
  accountName?: string;
  accountType?: BrokerAccountType;
  environment?: BrokerEnvironment;
  externalRef?: string;
  status?: BrokerAccountStatus;
  isPrimary?: boolean;
  meta?: Record<string, unknown>;
  credentials?: BrokerAccountCredentialsInput;
}

export interface TradeAttributes {
  id?: number;
  userId: number;
  strategyId?: number | null;
  brokerAccountId?: number | null;
  signalId?: number | null;
  broker: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity?: number | null;
  lot?: number | null;
  ticket?: string | null;
  status: 'open' | 'closed' | 'failed';
  entryPrice: number;
  exitPrice?: number | null;
  openedAt: Date;
  closedAt?: Date | null;
  closeReason?: string | null;
  pnlPct?: number | null;
  raw?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BrokerAccountPublicView {
  id: number;
  userId: number;
  brokerId: string;
  accountName: string;
  accountType: BrokerAccountType;
  environment: BrokerEnvironment;
  executionMode: 'demo' | 'live';
  externalRef: string | null;
  status: BrokerAccountStatus;
  isPrimary: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  meta: Record<string, unknown>;
  hasCredentials: boolean;
  credentialFields: string[];
  createdAt: string;
  updatedAt: string;
}
