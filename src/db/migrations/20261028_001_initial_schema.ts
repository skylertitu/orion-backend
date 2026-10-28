import type { MigrationFn } from 'umzug';
import type { QueryInterface } from 'sequelize';
import sequelize from '../../config/database';
import '../../models';

export const up: MigrationFn<QueryInterface> = async () => {
  // Sincroniza todas las tablas del modelo de forma segura (sin alter forzado)
  await sequelize.sync();
};

export const down: MigrationFn<QueryInterface> = async ({ context: qi }) => {
  // Reversión opcional
};
