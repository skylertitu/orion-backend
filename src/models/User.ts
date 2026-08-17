import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import { UserAttributes } from '../types';
import bcrypt from 'bcrypt';

class User extends Model<UserAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public firebaseUid!: string | null;
  public firstName!: string | null;
  public lastName!: string | null;
  public phone!: string | null;
  public country!: string | null;
  public language!: string | null;
  public timezone!: string | null;
  public avatar!: string | null;
  public termsAccepted!: boolean;
  public emailVerified!: boolean;
  public resetPasswordToken!: string | null;
  public resetPasswordExpires!: Date | null;
  public lastLoginAt!: Date | null;
  public balance!: number;
  public role!: 'user' | 'admin';

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    firebaseUid: {
      type: DataTypes.STRING(128),
      allowNull: true,
      unique: true,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'Global',
    },
    language: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'es',
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'UTC-5',
    },
    avatar: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    termsAccepted: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    resetPasswordToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    balance: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user',
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password && !user.password.startsWith('$2b$')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed('password') && !user.password.startsWith('$2b$')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
  }
);

export default User;
