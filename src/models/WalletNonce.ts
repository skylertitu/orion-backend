import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export interface WalletNonceAttributes {
  id?: number;
  userId: number;
  nonce: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt?: Date;
}

class WalletNonce extends Model<WalletNonceAttributes> implements WalletNonceAttributes {
  public id!: number;
  public userId!: number;
  public nonce!: string;
  public expiresAt!: Date;
  public usedAt!: Date | null;
  public readonly createdAt!: Date;
}

WalletNonce.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    nonce: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    usedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'wallet_nonces',
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['userId'] }],
  }
);

export default WalletNonce;
