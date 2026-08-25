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
  public role!: 'user' | 'admin' | 'superadmin';
  public plan!: string | null;
  public sessionVersion!: number;
  public blocked!: boolean;
  public blockedReason!: string | null;
  public blockedAt!: Date | null;

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
      type: DataTypes.STRING(20),
      defaultValue: 'user',
      allowNull: false,
    },
    blocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    blockedReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    blockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    plan: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'builder',
    },
    sessionVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password && !user.password.startsWith('$2b$')) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed('password') && !user.password.startsWith('$2b$')) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
    },
  }
);

export function bumpSessionVersion(user: User): void {
  user.sessionVersion = (Number(user.sessionVersion) || 0) + 1;
}

export async function ensureUserPlanColumn(): Promise<void> {
  const qi = sequelize.getQueryInterface();
  let table: Record<string, { type?: string }>;
  try {
    table = await qi.describeTable('users');
  } catch {
    return;
  }
  if (!table.plan) {
    await qi.addColumn('users', 'plan', {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'builder',
    });
  }
  if (!table.sessionVersion) {
    await qi.addColumn('users', 'sessionVersion', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  }
  if (!table.blocked) {
    await qi.addColumn('users', 'blocked', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  }
  if (!table.blockedReason) {
    await qi.addColumn('users', 'blockedReason', {
      type: DataTypes.STRING(255),
      allowNull: true,
    });
  }
  if (!table.blockedAt) {
    await qi.addColumn('users', 'blockedAt', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }
  try {
    await sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'superadmin'`);
  } catch {
    /* enum may not exist if role is already VARCHAR */
  }
  try {
    await sequelize.query(`ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20) USING role::text`);
  } catch {
    /* already VARCHAR or dialect mismatch */
  }
  await sequelize.query(
    `UPDATE users SET plan = 'builder' WHERE role = 'user' AND (plan IS NULL OR plan = '')`
  );
}

export default User;
