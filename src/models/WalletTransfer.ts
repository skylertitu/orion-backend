import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export type WalletTransferType = 'deposit' | 'withdraw' | 'swap';
export type WalletTransferStatus = 'pending' | 'confirmed' | 'rejected' | 'failed';

export interface WalletTransferAttributes {
  id?: number;
  userId: number;
  walletId: number;
  type: WalletTransferType;
  chain: 'solana';
  asset: string;
  amount: number;
  status: WalletTransferStatus;
  fromAddress?: string | null;
  toAddress?: string | null;
  txHash?: string | null;
  note?: string | null;
  processedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class WalletTransfer extends Model<WalletTransferAttributes> implements WalletTransferAttributes {
  public id!: number;
  public userId!: number;
  public walletId!: number;
  public type!: WalletTransferType;
  public chain!: 'solana';
  public asset!: string;
  public amount!: number;
  public status!: WalletTransferStatus;
  public fromAddress!: string | null;
  public toAddress!: string | null;
  public txHash!: string | null;
  public note!: string | null;
  public processedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

WalletTransfer.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    walletId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(20), allowNull: false },
    chain: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'solana' },
    asset: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'SOL' },
    amount: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
    fromAddress: { type: DataTypes.STRING(64), allowNull: true },
    toAddress: { type: DataTypes.STRING(64), allowNull: true },
    txHash: { type: DataTypes.STRING(128), allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    processedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'wallet_transfers',
    timestamps: true,
    indexes: [
      { fields: ['userId', 'status'] },
      { fields: ['walletId'] },
    ],
  }
);

export default WalletTransfer;
