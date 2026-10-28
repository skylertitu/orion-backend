import { activateKillSwitch, deactivateKillSwitch } from './killSwitch.service';
import Trade from '../models/Trade';
import RiskSettings from '../models/RiskSettings';
import * as riskService from './risk.service';

jest.mock('./risk.service');

describe('KillSwitchService', () => {
  let findAllSpy: jest.SpyInstance;
  let findOrCreateSpy: jest.SpyInstance;
  let findByPkSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    findAllSpy = jest.spyOn(Trade, 'findAll').mockResolvedValue([]);
    findOrCreateSpy = jest.spyOn(RiskSettings, 'findOrCreate').mockResolvedValue([
      { update: jest.fn().mockResolvedValue(true) } as any,
      true,
    ]);
    findByPkSpy = jest.spyOn(RiskSettings, 'findByPk').mockResolvedValue({
      update: jest.fn().mockResolvedValue(true),
    } as any);
  });

  afterEach(() => {
    findAllSpy.mockRestore();
    findOrCreateSpy.mockRestore();
    findByPkSpy.mockRestore();
  });

  describe('activateKillSwitch', () => {
    it('activates global kill switch and calls pauseByRisk', async () => {
      const result = await activateKillSwitch({
        reason: 'Parada de emergencia manual',
        closeAllPositions: false,
      });

      expect(result.active).toBe(true);
      expect(result.scope).toBe('global');
      expect(riskService.pauseByRisk).toHaveBeenCalledWith(
        'Parada de emergencia manual',
        undefined
      );
    });

    it('activates user-specific kill switch without affecting global', async () => {
      const mockRow = {
        update: jest.fn().mockResolvedValue(true),
      };
      findOrCreateSpy.mockResolvedValue([mockRow as any, true]);

      const result = await activateKillSwitch({
        userId: 42,
        reason: 'Margen insuficiente en cuenta de usuario',
        closeAllPositions: false,
      });

      expect(result.active).toBe(true);
      expect(result.scope).toBe('user');
      expect(findOrCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user_42' } })
      );
      expect(mockRow.update).toHaveBeenCalledWith(
        expect.objectContaining({ pausedByRisk: true })
      );
      expect(riskService.pauseByRisk).not.toHaveBeenCalled();
    });

    it('liquidates open trades when closeAllPositions is true', async () => {
      const mockTrade = {
        id: 777,
        broker: 'binance',
        side: 'buy',
        quantity: 0.5,
        ticket: 'SIMULATED-123',
        symbol: 'BTCUSDT',
        entryPrice: 60000,
        update: jest.fn().mockResolvedValue(true),
      };

      findAllSpy.mockResolvedValue([mockTrade as any]);

      const result = await activateKillSwitch({
        closeAllPositions: true,
        reason: 'Caída abrupta del mercado',
      });

      expect(result.closedPositionsCount).toBe(1);
      expect(mockTrade.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'closed',
          closeReason: 'kill_switch_emergency_close',
        })
      );
    });
  });

  describe('deactivateKillSwitch', () => {
    it('deactivates global kill switch and calls resumeFromRisk', async () => {
      const result = await deactivateKillSwitch();

      expect(result.active).toBe(false);
      expect(result.scope).toBe('global');
      expect(riskService.resumeFromRisk).toHaveBeenCalled();
    });

    it('deactivates user-specific kill switch and clears pausedByRisk', async () => {
      const mockRow = {
        update: jest.fn().mockResolvedValue(true),
      };
      findByPkSpy.mockResolvedValue(mockRow as any);

      const result = await deactivateKillSwitch(42);

      expect(result.active).toBe(false);
      expect(result.scope).toBe('user');
      expect(findByPkSpy).toHaveBeenCalledWith('user_42');
      expect(mockRow.update).toHaveBeenCalledWith(
        expect.objectContaining({ pausedByRisk: false })
      );
    });
  });
});
