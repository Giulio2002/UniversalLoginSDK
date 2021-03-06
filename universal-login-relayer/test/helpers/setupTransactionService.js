import {EventEmitter} from 'fbemitter';
import {loadFixture} from 'ethereum-waffle';
import MessageHandler from '../../lib/services/transactions/MessageHandler';
import TransactionQueueService from '../../lib/services/transactions/TransactionQueueService';
import TransactionQueueStore from '../../lib/services/transactions/TransactionQueueStore';
import AuthorisationService from '../../lib/services/authorisationService';
import basicWalletContractWithMockToken from '../fixtures/basicWalletContractWithMockToken';
import PendingMessagesStore from '../../lib/services/transactions/PendingMessagesStore';
import PendingMessages from '../../lib/services/transactions/PendingMessages';

export default async function setupTransactionService(knex) {
  const {wallet, actionKey, provider, mockToken, walletContract, otherWallet} = await loadFixture(basicWalletContractWithMockToken);
  const hooks = new EventEmitter();
  const authorisationService = new AuthorisationService(knex);
  const pendingMessagesStore = new PendingMessagesStore();
  const pendingMessages = new PendingMessages(wallet, pendingMessagesStore);
  const transactionQueueStore = new TransactionQueueStore(knex);
  const transactionQueueService = new TransactionQueueService(wallet, provider, transactionQueueStore);
  const messageHandler = new MessageHandler(wallet, authorisationService, hooks, provider, transactionQueueService, pendingMessages);
  return { wallet, actionKey, provider, mockToken, authorisationService, messageHandler, walletContract, otherWallet };
}
