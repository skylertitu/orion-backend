import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import { TradeAttributes } from '../types';

class Trade extends Model<TradeAttributes> implements TradeAttributes {
  public id!: number;
  public userId!: number;
  public strategyId!: number | null;
  public brokerAccountId!: number | null;
  public signalId!: number | null;
  public broker!: string;
  public symbol!: string;
  public side!: 'buy' | 'sell';
  public quantity!: number | null;
  public lot!: number | null;
  public ticket!: string | null;
  public status!: 'open' | 'closed' | 'failed';
  public entryPrice!: number;
  public exitPrice!: number | null;
  public openedAt!: Date;
  public closedAt!: Date | null;
  public closeReason!: string | null;
  public pnlPct!: number | null;
  public raw!: Record<string, unknown> | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Trade.init(
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
    strategyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    brokerAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    signalId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    broker: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    symbol: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    side: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
    },
    lot: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
    },
    ticket: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'open',
    },
    entryPrice: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    exitPrice: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
    },
    openedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closeReason: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    pnlPct: {
      type: DataTypes.DECIMAL(12, 6),
      allowNull: true,
    },
    raw: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'trades',
    timestamps: true,
    indexes: [
      { fields: ['userId', 'status'] },
      { fields: ['strategyId'] },
      { fields: ['brokerAccountId'] },
    ],
  }
);

export default Trade;
