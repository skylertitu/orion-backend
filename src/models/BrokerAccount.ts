import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import { BrokerAccountAttributes } from '../types';

class BrokerAccount extends Model<BrokerAccountAttributes> implements BrokerAccountAttributes {
  public id!: number;
  public userId!: number;
  public brokerId!: string;
  public accountName!: string;
  public accountType!: BrokerAccountAttributes['accountType'];
  public environment!: BrokerAccountAttributes['environment'];
  public externalRef!: string | null;
  public status!: BrokerAccountAttributes['status'];
  public isPrimary!: boolean;
  public lastCheckedAt!: Date | null;
  public lastError!: string | null;
  public meta!: Record<string, unknown>;
  public apiKeyEnc!: string | null;
  public apiSecretEnc!: string | null;
  public passphraseEnc!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BrokerAccount.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    brokerId: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    accountName: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    accountType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'spot',
    },
    environment: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'mainnet',
    },
    externalRef: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lastCheckedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    apiKeyEnc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    apiSecretEnc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    passphraseEnc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'broker_accounts',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['userId', 'brokerId'] },
    ],
  }
);

export default BrokerAccount;
