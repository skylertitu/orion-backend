import User from './User';
import Strategy from './Strategy';
import BrokerAccount from './BrokerAccount';
import Signal from './Signal';
import Trade from './Trade';
import Wallet from './Wallet';
import WalletNonce from './WalletNonce';
import WalletTransfer from './WalletTransfer';
import Indicator from './Indicator';
import IndicatorBlock from './IndicatorBlock';
import SystemControl from './SystemControl';
import IntegrationSecret from './IntegrationSecret';

User.hasMany(Strategy, { foreignKey: 'userId', as: 'strategies', onDelete: 'CASCADE' });
Strategy.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(BrokerAccount, { foreignKey: 'userId', as: 'brokerAccounts', onDelete: 'CASCADE' });
BrokerAccount.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Signal, { foreignKey: 'userId', as: 'signals', onDelete: 'CASCADE' });
Signal.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Strategy.hasMany(Signal, { foreignKey: 'strategyId', as: 'signals', onDelete: 'CASCADE' });
Signal.belongsTo(Strategy, { foreignKey: 'strategyId', as: 'strategy' });
BrokerAccount.hasMany(Signal, { foreignKey: 'brokerAccountId', as: 'signals' });
Signal.belongsTo(BrokerAccount, { foreignKey: 'brokerAccountId', as: 'brokerAccount' });

User.hasMany(Trade, { foreignKey: 'userId', as: 'trades', onDelete: 'CASCADE' });
Trade.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Strategy.hasMany(Trade, { foreignKey: 'strategyId', as: 'trades', onDelete: 'SET NULL' });
Trade.belongsTo(Strategy, { foreignKey: 'strategyId', as: 'strategy' });
BrokerAccount.hasMany(Trade, { foreignKey: 'brokerAccountId', as: 'trades', onDelete: 'SET NULL' });
Trade.belongsTo(BrokerAccount, { foreignKey: 'brokerAccountId', as: 'brokerAccount' });
Signal.hasMany(Trade, { foreignKey: 'signalId', as: 'trades', onDelete: 'SET NULL' });
Trade.belongsTo(Signal, { foreignKey: 'signalId', as: 'signal' });

User.hasMany(Wallet, { foreignKey: 'userId', as: 'wallets', onDelete: 'CASCADE' });
Wallet.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(WalletNonce, { foreignKey: 'userId', as: 'walletNonces', onDelete: 'CASCADE' });
WalletNonce.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(WalletTransfer, { foreignKey: 'userId', as: 'walletTransfers', onDelete: 'CASCADE' });
WalletTransfer.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Wallet.hasMany(WalletTransfer, { foreignKey: 'walletId', as: 'transfers', onDelete: 'CASCADE' });
WalletTransfer.belongsTo(Wallet, { foreignKey: 'walletId', as: 'wallet' });

User.hasMany(Indicator, { foreignKey: 'userId', as: 'indicators', onDelete: 'CASCADE' });
Indicator.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export { User, Strategy, BrokerAccount, Signal, Trade, Wallet, WalletNonce, WalletTransfer, Indicator, IndicatorBlock, SystemControl, IntegrationSecret };
