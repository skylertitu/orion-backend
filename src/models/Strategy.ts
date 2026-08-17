import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import { StrategyAttributes } from '../types';

class Strategy extends Model<StrategyAttributes> implements StrategyAttributes {
  public id!: number;
  public userId!: number;
  public name!: string;
  public description!: string;
  public config!: object;
  public isActive!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Strategy.init(
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
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    config: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'strategies',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
    ],
  }
);

export default Strategy;
