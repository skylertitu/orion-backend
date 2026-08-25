import { DataTypes, Model, QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import WalletTransfer from './WalletTransfer';
import { logger } from '../utils/logger';

export interface WalletAttributes {
  id?: number;
  userId: number;
  chain: 'solana';
  address: string;
  label?: string | null;
  isPrimary: boolean;
  verified: boolean;
  source: 'extension' | 'manual' | string;
  verifiedAt: Date;
  lastUsedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class Wallet extends Model<WalletAttributes> implements WalletAttributes {
  public id!: number;
  public userId!: number;
  public chain!: 'solana';
  public address!: string;
  public label!: string | null;
  public isPrimary!: boolean;
  public verified!: boolean;
  public source!: string;
  public verifiedAt!: Date;
  public lastUsedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Wallet.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    chain: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'solana' },
    address: { type: DataTypes.STRING(64), allowNull: false },
    label: { type: DataTypes.STRING(80), allowNull: true },
    isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'extension' },
    verifiedAt: { type: DataTypes.DATE, allowNull: false },
    lastUsedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'wallets',
    timestamps: true,
    indexes: [
      { unique: true, name: 'wallets_chain_address_unique', fields: ['chain', 'address'] },
      { fields: ['userId'] },
    ],
  }
);

export async function ensureWalletColumns(): Promise<void> {
  const qi = sequelize.getQueryInterface();
  let table: Record<string, unknown>;
  try {
    table = await qi.describeTable('wallets');
  } catch {
    return;
  }
  if (!table.verified) {
    await qi.addColumn('wallets', 'verified', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  }
  if (!table.source) {
    await qi.addColumn('wallets', 'source', {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'extension',
    });
  }
  await ensureUniqueWalletAddress();
}

async function ensureUniqueWalletAddress(): Promise<void> {
  const dupes = (await sequelize.query(
    `SELECT chain, address FROM wallets GROUP BY chain, address HAVING COUNT(*) > 1`,
    { type: QueryTypes.SELECT }
  )) as Array<{ chain: string; address: string }>;

  for (const dupe of dupes) {
    const rows = await Wallet.findAll({
      where: { chain: dupe.chain, address: dupe.address },
      order: [
        ['verified', 'DESC'],
        ['id', 'ASC'],
      ],
    });
    const keep = rows[0];
    for (const extra of rows.slice(1)) {
      await WalletTransfer.destroy({ where: { walletId: extra.id } });
      await extra.destroy();
      logger.warn(
        `[wallet] Dirección ${dupe.address} duplicada: se dejó user=${keep.userId} y se quitó user=${extra.userId}`
      );
    }
  }

  const qi = sequelize.getQueryInterface();
  const indexes = (await qi.showIndex('wallets')) as Array<{
    name?: string;
    unique?: boolean;
    fields?: Array<string | { attribute?: string; name?: string }>;
  }>;
  const hasUnique = indexes.some((idx) => {
    if (!idx.unique) return false;
    const fields = (idx.fields || []).map((f) => (typeof f === 'string' ? f : f.attribute || f.name || ''));
    return fields.includes('chain') && fields.includes('address');
  });
  if (hasUnique) return;
  try {
    await qi.addIndex('wallets', ['chain', 'address'], {
      unique: true,
      name: 'wallets_chain_address_unique',
    });
  } catch (err: any) {
    if (err?.parent?.code === '23505' || String(err?.message || '').includes('already exists')) return;
    throw err;
  }
}

export default Wallet;
