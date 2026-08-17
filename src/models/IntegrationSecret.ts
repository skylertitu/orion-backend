import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export interface IntegrationSecretAttributes {
  id: string;
  secretEnc?: string | null;
  updatedBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class IntegrationSecret extends Model<IntegrationSecretAttributes> implements IntegrationSecretAttributes {
  public id!: string;
  public secretEnc!: string | null;
  public updatedBy!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

IntegrationSecret.init(
  {
    id: {
      type: DataTypes.STRING(40),
      primaryKey: true,
    },
    secretEnc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'integration_secrets',
    timestamps: true,
  }
);

export default IntegrationSecret;
