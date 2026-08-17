// ============================================================
// MetaTrader Integration - ZeroMQ Service
// Comandos serializados + requestId para no cruzar respuestas.
// ============================================================
import { randomUUID } from 'crypto';
import * as zmq from 'zeromq';
import { MtCommand, MtResponse } from './mt.types';
import { logger } from '../../utils/logger';

const ZMQ_HOST = process.env.MT_ZMQ_HOST || '127.0.0.1';
const ZMQ_PUSH_PORT = process.env.MT_ZMQ_PUSH_PORT || '5555';
const ZMQ_PULL_PORT = process.env.MT_ZMQ_PULL_PORT || '5556';
const ORDER_TIMEOUT_MS = parseInt(process.env.MT_ORDER_TIMEOUT_MS || '5000', 10);

class MetaTraderService {
  private pushSocket: zmq.Push | null = null;
  private pullSocket: zmq.Pull | null = null;
  private connected = false;
  private chain: Promise<unknown> = Promise.resolve();

  async connect(): Promise<void> {
    try {
      this.pushSocket = new zmq.Push();
      this.pullSocket = new zmq.Pull();

      await this.pushSocket.connect(`tcp://${ZMQ_HOST}:${ZMQ_PUSH_PORT}`);
      await this.pullSocket.connect(`tcp://${ZMQ_HOST}:${ZMQ_PULL_PORT}`);

      const alive = await this.ping();
      this.connected = alive;
      if (alive) {
        logger.info(`[MetaTrader] EA respondió PONG → tcp://${ZMQ_HOST}:${ZMQ_PUSH_PORT} / ${ZMQ_PULL_PORT}`);
      } else {
        logger.warn('[MetaTrader] Sockets abiertos pero el EA no respondió al PING. ¿Está OrionBridge adjunto?');
      }
    } catch (err) {
      this.connected = false;
      logger.error('[MetaTrader] Error al conectar sockets ZeroMQ:', err);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.pushSocket) { this.pushSocket.close(); this.pushSocket = null; }
      if (this.pullSocket) { this.pullSocket.close(); this.pullSocket = null; }
      this.connected = false;
      logger.info('[MetaTrader] Sockets cerrados.');
    } catch (err) {
      logger.error('[MetaTrader] Error al cerrar sockets:', err);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.sendCommand({ action: 'PING' });
      return response.status === 'PONG';
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendCommand(command: MtCommand): Promise<MtResponse> {
    return this.enqueue(() => this.sendCommandLocked(command));
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  private async sendCommandLocked(command: MtCommand): Promise<MtResponse> {
    if (!this.pushSocket || !this.pullSocket) {
      throw new Error('[MetaTrader] Sockets no inicializados. ¿Está el EA corriendo?');
    }

    const requestId = command.requestId || randomUUID();
    const payload = JSON.stringify({ ...command, requestId });
    await this.pushSocket.send(payload);

    const deadline = Date.now() + ORDER_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      try {
        const response = await this.receiveOnce(remaining);
        if (!response.requestId || response.requestId === requestId) {
          return response;
        }
        logger.warn(`[MetaTrader] Respuesta rezagada descartada (requestId=${response.requestId})`);
      } catch (err: any) {
        if (String(err?.message || '').includes('timeout')) {
          await this.drainStale(200);
          throw new Error('MetaTrader EA timeout: sin respuesta');
        }
        throw err;
      }
    }

    await this.drainStale(200);
    throw new Error('MetaTrader EA timeout: sin respuesta');
  }

  private async receiveOnce(timeoutMs: number): Promise<MtResponse> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), Math.max(1, timeoutMs))
    );
    const responsePromise = (async () => {
      const [raw] = await this.pullSocket!.receive();
      return JSON.parse(raw.toString()) as MtResponse;
    })();
    return Promise.race([responsePromise, timeoutPromise]);
  }

  private async drainStale(timeoutMs: number): Promise<void> {
    try {
      await this.receiveOnce(timeoutMs);
    } catch {
      /* no había mensaje pendiente */
    }
  }

  async buyMarket(
    symbol: string,
    lots: number,
    sl = 0,
    tp = 0,
    comment = 'Orion',
    magic?: number
  ): Promise<MtResponse> {
    return this.sendCommand({ action: 'BUY', symbol, lots, sl, tp, comment, magic });
  }

  async sellMarket(
    symbol: string,
    lots: number,
    sl = 0,
    tp = 0,
    comment = 'Orion',
    magic?: number
  ): Promise<MtResponse> {
    return this.sendCommand({ action: 'SELL', symbol, lots, sl, tp, comment, magic });
  }

  async closePosition(ticket: number, magic?: number): Promise<MtResponse> {
    return this.sendCommand({ action: 'CLOSE', ticket, magic });
  }

  async closeAll(magic?: number): Promise<MtResponse> {
    return this.sendCommand({ action: 'CLOSE_ALL', magic });
  }

  async getPositions(magic?: number): Promise<MtResponse> {
    return this.sendCommand({ action: 'GET_POSITIONS', magic });
  }

  async getSymbols(): Promise<MtResponse> {
    return this.sendCommand({ action: 'GET_SYMBOLS' });
  }

  async getMtPrice(symbol: string): Promise<MtResponse> {
    return this.sendCommand({ action: 'GET_PRICE', symbol });
  }
}

export const metatraderService = new MetaTraderService();
