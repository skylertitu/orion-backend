import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export type PlanRequestStatus = 'pending' | 'fulfilled' | 'cancelled';

export interface PlanRequestAttributes {
  id?: number;
  userId: number;
  requestedPlan: string;
  status?: PlanRequestStatus;
  note?: string | null;
  stripeSessionId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class PlanRequest extends Model<PlanRequestAttributes> implements PlanRequestAttributes {
  public id!: number;
  public userId!: number;
  public requestedPlan!: string;
  public status!: PlanRequestStatus;
  public note!: string | null;
  public stripeSessionId!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PlanRequest.init(
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
    requestedPlan: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    },
    note: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    stripeSessionId: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'plan_requests',
    indexes: [
      { fields: ['userId'] },
      { fields: ['status'] },
    ],
  }
);

export default PlanRequest;
