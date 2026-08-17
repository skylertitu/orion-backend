import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export interface SignalAttributes {
  id?: number;
  strategyId: number;
  userId: number;
  symbol: string;
  action: string;
  confidence: number;
  reason: string;
  indicators: object;
  price: number;
  executed: boolean;
  source?: 'strategy' | 'lucy' | 'manual';
  brokerAccountId?: number | null;
  lucyRunId?: string | null;
  decision?: object | null;
  createdAt?: Date;
}

class Signal extends Model<SignalAttributes> implements SignalAttributes {
  public id!: number;
  public strategyId!: number;
  public userId!: number;
  public symbol!: string;
  public action!: string;
  public confidence!: number;
  public reason!: string;
  public indicators!: object;
  public price!: number;
  public executed!: boolean;
  public source!: 'strategy' | 'lucy' | 'manual';
  public brokerAccountId!: number | null;
  public lucyRunId!: string | null;
  public decision!: object | null;

  public readonly createdAt!: Date;
}

Signal.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    strategyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    symbol: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    confidence: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    reason: {
      type: DataTypes.TEXT,
    },
    indicators: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    executed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    source: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'strategy',
    },
    brokerAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    lucyRunId: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    decision: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'signals',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['strategyId'] },
      { fields: ['createdAt'] },
    ],
  }
);

export default Signal;
