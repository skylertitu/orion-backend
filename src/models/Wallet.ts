import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export interface WalletAttributes {
  id?: number;
  userId: number;
  chain: 'solana';
  address: string;
  label?: string | null;
  isPrimary: boolean;
  verifiedAt: Date;
  lastUsedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class Wallet extends Model<WalletAttributes> implements WalletAttributes {
  public id!: number;
  public userId!: number;
  public chain!: 'solana';
  public address!: string;
  public label!: string | null;
  public isPrimary!: boolean;
  public verifiedAt!: Date;
  public lastUsedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Wallet.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    chain: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'solana' },
    address: { type: DataTypes.STRING(64), allowNull: false },
    label: { type: DataTypes.STRING(80), allowNull: true },
    isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    verifiedAt: { type: DataTypes.DATE, allowNull: false },
    lastUsedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'wallets',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['chain', 'address'] },
      { fields: ['userId'] },
    ],
  }
);

export default Wallet;
