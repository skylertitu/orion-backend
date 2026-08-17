import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export interface IndicatorBlockAttributes {
  sourceHash: string;
  name: string;
  blockedBy: number;
  createdAt?: Date;
  updatedAt?: Date;
}

class IndicatorBlock extends Model<IndicatorBlockAttributes> implements IndicatorBlockAttributes {
  public sourceHash!: string;
  public name!: string;
  public blockedBy!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

IndicatorBlock.init(
  {
    sourceHash: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    blockedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'indicator_blocks',
    timestamps: true,
  }
);

export default IndicatorBlock;
