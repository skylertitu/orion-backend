import type { MigrationFn } from 'umzug';
import { DataTypes, type QueryInterface } from 'sequelize';

export const up: MigrationFn<QueryInterface> = async ({ context: qi }) => {
  // 1. Columnas en users
  try {
    const userTable = await qi.describeTable('users');
    if (!userTable.plan) {
      await qi.addColumn('users', 'plan', {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'builder',
      });
    }
    if (!userTable.sessionVersion) {
      await qi.addColumn('users', 'sessionVersion', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!userTable.blocked) {
      await qi.addColumn('users', 'blocked', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  } catch (err) {
    // Si la tabla aún no existe, sync inicial se encarga
  }

  // 2. Columnas en wallets
  try {
    const walletTable = await qi.describeTable('wallets');
    if (!walletTable.verified) {
      await qi.addColumn('wallets', 'verified', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
    if (!walletTable.source) {
      await qi.addColumn('wallets', 'source', {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'extension',
      });
    }
  } catch (err) {
    // Si la tabla aún no existe
  }

  // 3. Columnas en indicators
  try {
    const indicatorTable = await qi.describeTable('indicators');
    if (!indicatorTable.category) {
      await qi.addColumn('indicators', 'category', {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'custom',
      });
    }
  } catch (err) {
    // Si la tabla aún no existe
  }
};

export const down: MigrationFn<QueryInterface> = async () => {
  // Reversión opcional
};
