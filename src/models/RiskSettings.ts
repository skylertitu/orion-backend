import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export const RISK_SETTINGS_ID = 'global';

export interface RiskSettingsAttributes {
  id: string;
  maxDailyLossUsd: number;
  maxOrderUsd: number;
  maxOpenPositions: number;
  maxErrorStreak: number;
  pausedByRisk: boolean;
  pauseReason?: string | null;
  updatedBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class RiskSettings extends Model<RiskSettingsAttributes> implements RiskSettingsAttributes {
  public id!: string;
  public maxDailyLossUsd!: number;
  public maxOrderUsd!: number;
  public maxOpenPositions!: number;
  public maxErrorStreak!: number;
  public pausedByRisk!: boolean;
  public pauseReason!: string | null;
  public updatedBy!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RiskSettings.init(
  {
    id: { type: DataTypes.STRING(40), primaryKey: true },
    maxDailyLossUsd: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: 100 },
    maxOrderUsd: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: 50 },
    maxOpenPositions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    maxErrorStreak: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    pausedByRisk: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    pauseReason: { type: DataTypes.STRING(240), allowNull: true },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'risk_settings',
    timestamps: true,
  }
);

export default RiskSettings;
