import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export type SystemModuleId =
  | 'trading'
  | 'worker'
  | 'lucy'
  | 'market'
  | 'mt5'
  | 'indicators'
  | 'accounts'
  | 'jupiter';

export interface SystemControlAttributes {
  id: SystemModuleId;
  enabled: boolean;
  note?: string | null;
  updatedBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class SystemControl extends Model<SystemControlAttributes> implements SystemControlAttributes {
  public id!: SystemModuleId;
  public enabled!: boolean;
  public note!: string | null;
  public updatedBy!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SystemControl.init(
  {
    id: {
      type: DataTypes.STRING(40),
      primaryKey: true,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    note: {
      type: DataTypes.STRING(240),
      allowNull: true,
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'system_controls',
    timestamps: true,
  }
);

export default SystemControl;
