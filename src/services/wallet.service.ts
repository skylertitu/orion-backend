import crypto from 'crypto';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { User, Wallet, WalletNonce, WalletTransfer } from '../models';
import {
  buildWalletLinkMessage,
  isSolanaAddress,
  verifySolanaSignature,
} from '../utils/solanaVerify';

const NONCE_TTL_MS = 5 * 60 * 1000;
const MIN_AMOUNT = 0.001;
const MAX_WITHDRAW = Number(process.env.WALLET_MAX_WITHDRAW || '10');

function httpError(message: string, status: number) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

function toPublicWallet(wallet: Wallet) {
  return {
    id: wallet.id,
    userId: wallet.userId,
    chain: wallet.chain,
    address: wallet.address,
    label: wallet.label,
    isPrimary: wallet.isPrimary,
    verifiedAt: wallet.verifiedAt.toISOString(),
    lastUsedAt: wallet.lastUsedAt ? wallet.lastUsedAt.toISOString() : null,
    createdAt: wallet.createdAt.toISOString(),
  };
}

function toPublicTransfer(row: WalletTransfer) {
  return {
    id: row.id,
    walletId: row.walletId,
    type: row.type,
    chain: row.chain,
    asset: row.asset,
    amount: Number(row.amount),
    status: row.status,
    fromAddress: row.fromAddress,
    toAddress: row.toAddress,
    txHash: row.txHash,
    note: row.note,
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class WalletService {
  async list(userId: number) {
    const wallets = await Wallet.findAll({
      where: { userId },
      order: [['isPrimary', 'DESC'], ['createdAt', 'DESC']],
    });
    return wallets.map(toPublicWallet);
  }

  async createNonce(userId: number) {
    const nonce = crypto.randomBytes(16).toString('hex');
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MS);
    await WalletNonce.create({ userId, nonce, expiresAt });
    return {
      nonce,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      chain: 'solana' as const,
    };
  }

  async link(userId: number, input: { address: string; signature: string; nonce: string; issuedAt: string; label?: string }) {
    const address = input.address.trim();
    if (!isSolanaAddress(address)) {
      throw httpError('Dirección Solana inválida', 400);
    }

    const nonceRow = await WalletNonce.findOne({
      where: { userId, nonce: input.nonce, usedAt: { [Op.is]: null } },
    });
    if (!nonceRow || nonceRow.expiresAt < new Date()) {
      throw httpError('Nonce inválido o expirado. Vuelve a conectar la billetera.', 400);
    }

    const message = buildWalletLinkMessage({
      userId,
      address,
      nonce: input.nonce,
      issuedAt: input.issuedAt,
    });
    if (!verifySolanaSignature(address, message, input.signature)) {
      throw httpError('La firma no corresponde a esa billetera', 401);
    }

    const taken = await Wallet.findOne({ where: { chain: 'solana', address } });
    if (taken && taken.userId !== userId) {
      throw httpError('Esa billetera ya está vinculada a otra cuenta', 409);
    }

    await nonceRow.update({ usedAt: new Date() });

    if (taken) {
      await taken.update({
        verifiedAt: new Date(),
        lastUsedAt: new Date(),
        label: input.label?.trim() || taken.label,
      });
      return toPublicWallet(taken);
    }

    const hasPrimary = await Wallet.findOne({ where: { userId, isPrimary: true } });
    const wallet = await Wallet.create({
      userId,
      chain: 'solana',
      address,
      label: input.label?.trim() || 'Phantom',
      isPrimary: !hasPrimary,
      verifiedAt: new Date(),
      lastUsedAt: new Date(),
    });
    return toPublicWallet(wallet);
  }

  async setPrimary(userId: number, walletId: number) {
    const wallet = await this.requireOwned(userId, walletId);
    await Wallet.update({ isPrimary: false }, { where: { userId } });
    await wallet.update({ isPrimary: true });
    return toPublicWallet(wallet);
  }

  async unlink(userId: number, walletId: number) {
    const wallet = await this.requireOwned(userId, walletId);
    const pending = await WalletTransfer.count({
      where: { walletId, userId, status: 'pending' },
    });
    if (pending > 0) {
      throw httpError('No puedes desvincular una billetera con transferencias pendientes', 409);
    }
    await wallet.destroy();
  }

  async listTransfers(userId: number) {
    const rows = await WalletTransfer.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    return rows.map(toPublicTransfer);
  }

  async requestDeposit(userId: number, walletId: number, amount: number, asset = 'SOL') {
    const wallet = await this.requireOwned(userId, walletId);
    this.assertAmount(amount);
    const treasury = process.env.WALLET_TREASURY_SOLANA || '';
    const transfer = await WalletTransfer.create({
      userId,
      walletId: wallet.id,
      type: 'deposit',
      chain: 'solana',
      asset,
      amount,
      status: 'pending',
      fromAddress: wallet.address,
      toAddress: treasury || null,
      note: treasury
        ? 'Envía el monto a la dirección de depósito y espera confirmación.'
        : 'Depósito registrado. Falta configurar WALLET_TREASURY_SOLANA para la dirección de cobro.',
    });
    await wallet.update({ lastUsedAt: new Date() });
    return {
      transfer: toPublicTransfer(transfer),
      depositAddress: treasury || null,
    };
  }

  async requestWithdraw(userId: number, walletId: number, amount: number, asset = 'SOL') {
    const wallet = await this.requireOwned(userId, walletId);
    this.assertAmount(amount);
    if (amount > MAX_WITHDRAW) {
      throw httpError(`El retiro máximo por operación es ${MAX_WITHDRAW} ${asset}`, 400);
    }

    const result = await sequelize.transaction(async (t) => {
      const user = await User.findByPk(userId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!user) throw httpError('Usuario no encontrado', 404);
      const balance = Number(user.balance || 0);
      if (balance < amount) {
        throw httpError('Saldo insuficiente', 400);
      }
      await user.update({ balance: balance - amount }, { transaction: t });
      const transfer = await WalletTransfer.create({
        userId,
        walletId: wallet.id,
        type: 'withdraw',
        chain: 'solana',
        asset,
        amount,
        status: 'pending',
        fromAddress: process.env.WALLET_TREASURY_SOLANA || null,
        toAddress: wallet.address,
        note: 'Retiro a tu billetera verificada. Pendiente de envío on-chain.',
      }, { transaction: t });
      return transfer;
    });

    await wallet.update({ lastUsedAt: new Date() });
    return toPublicTransfer(result);
  }

  async recordSwap(
    userId: number,
    taker: string,
    input: { symbol: string; amount: number },
    output: { symbol: string; amount?: number },
    result: { status: string; signature?: string; error?: string }
  ) {
    if (!isSolanaAddress(taker)) {
      throw httpError('Dirección taker inválida', 400);
    }
    const existing = await Wallet.findOne({ where: { chain: 'solana', address: taker } });
    if (existing && existing.userId !== userId) {
      throw httpError('Esa billetera pertenece a otra cuenta', 409);
    }
    let wallet = existing;
    if (!wallet) {
      const hasPrimary = await Wallet.findOne({ where: { userId, isPrimary: true } });
      wallet = await Wallet.create({
        userId,
        chain: 'solana',
        address: taker,
        label: 'Phantom',
        isPrimary: !hasPrimary,
        verifiedAt: new Date(),
        lastUsedAt: new Date(),
      });
    } else {
      await wallet.update({ lastUsedAt: new Date() });
    }

    const ok = result.status === 'Success';
    const transfer = await WalletTransfer.create({
      userId,
      walletId: wallet.id,
      type: 'swap',
      chain: 'solana',
      asset: `${input.symbol}->${output.symbol}`,
      amount: input.amount,
      status: ok ? 'confirmed' : 'failed',
      fromAddress: taker,
      toAddress: taker,
      txHash: result.signature || null,
      note: ok
        ? `Jupiter ${input.symbol} → ${output.symbol}${output.amount != null ? ` · out ${output.amount}` : ''}`
        : result.error || 'Swap fallido',
      processedAt: new Date(),
    });
    return toPublicTransfer(transfer);
  }

  private async requireOwned(userId: number, walletId: number) {
    const wallet = await Wallet.findOne({ where: { id: walletId, userId } });
    if (!wallet) throw httpError('Billetera no encontrada', 404);
    return wallet;
  }

  private assertAmount(amount: number) {
    if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
      throw httpError(`El monto mínimo es ${MIN_AMOUNT}`, 400);
    }
  }
}

export const walletService = new WalletService();
