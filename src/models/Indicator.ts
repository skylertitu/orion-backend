import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export interface IndicatorAttributes {
  id?: number;
  userId: number;
  clientId: string;
  name: string;
  source: string;
  sourceHash: string;
  enabled: boolean;
  blocked: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

class Indicator extends Model<IndicatorAttributes> implements IndicatorAttributes {
  public id!: number;
  public userId!: number;
  public clientId!: string;
  public name!: string;
  public source!: string;
  public sourceHash!: string;
  public enabled!: boolean;
  public blocked!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Indicator.init(
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
    clientId: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    source: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    sourceHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    blocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'indicators',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['userId', 'clientId'] },
      { fields: ['sourceHash'] },
      { fields: ['userId'] },
      { fields: ['enabled'] },
    ],
  }
);

export default Indicator;
