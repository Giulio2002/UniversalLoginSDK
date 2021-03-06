import {Wallet, providers} from 'ethers';
import {EventEmitter} from 'fbemitter';
import {SignedMessage} from '@universal-login/commons';
import {isAddKeyCall, getKeyFromData, isAddKeysCall, getRequiredSignatures, messageToTransaction} from '../../utils/utils';
import AuthorisationService from '../authorisationService';
import TransactionQueueService from './TransactionQueueService';
import PendingMessages from './PendingMessages';
import {ensureEnoughToken, ensureEnoughGas} from './validations';
import {decodeDataForExecuteSigned} from './serialisation';

class TransactionService {

  constructor(private wallet: Wallet, private authorisationService: AuthorisationService, private hooks: EventEmitter, private provider: providers.Provider, private transactionQueue: TransactionQueueService, private pendingMessages: PendingMessages) {
  }

  start() {
    this.transactionQueue.setOnTransactionSent(this.onTransactionSent);
    this.transactionQueue.start();
  }

  async onTransactionSent(sentTransaction: providers.TransactionResponse) {
    const {data} = sentTransaction;
    const message = decodeDataForExecuteSigned(data!);
    if (message.to === sentTransaction.to) {
      if (isAddKeyCall(message.data as string)) {
        await this.removeReqFromAuthService({...message, from: sentTransaction.to!});
        this.hooks.emit('added', sentTransaction);
      } else if (isAddKeysCall(message.data as string)) {
        this.hooks.emit('keysAdded', sentTransaction);
      }
    }
  }

  async executeSigned(message: SignedMessage) {
    const requiredSignatures = await getRequiredSignatures(message.from, this.wallet);
    if (requiredSignatures > 1) {
      const hash = await this.pendingMessages.add(message);
      const numberOfSignatures = (await this.pendingMessages.getStatus(hash)).collectedSignatures.length;
      if (await this.pendingMessages.isEnoughSignatures(hash) && numberOfSignatures !== 1) {
        return this.executePending(hash, message);
      }
      return JSON.stringify(this.pendingMessages.getStatus(hash));
    } else {
      return this.execute(message);
    }
  }

  private async executePending(hash: string, message: SignedMessage) {
    const finalMessage = this.pendingMessages.getMessageWithSignatures(message, hash);
    await this.pendingMessages.ensureCorrectExecution(hash);
    const transaction: any = await this.execute(finalMessage);
    await this.pendingMessages.remove(hash);
    return transaction;
  }

  async execute(message: SignedMessage) {
    await ensureEnoughToken(this.provider, message);
    const transaction: providers.TransactionRequest = messageToTransaction(message);
    await ensureEnoughGas(this.provider, this.wallet.address, transaction, message);
    const sentTransaction = await this.wallet.sendTransaction(transaction);
    await this.onTransactionSent(sentTransaction);
    return sentTransaction;
  }

  private async removeReqFromAuthService(message: SignedMessage) {
    const key = getKeyFromData(message.data as string);
    await this.authorisationService.removeRequest(message.from, key);
  }

  async getStatus(hash: string) {
    if (this.pendingMessages.isPresent(hash)){
      return this.pendingMessages.getStatus(hash);
    } else {
      return null;
    }
  }

  stop() {
    this.transactionQueue.stop();
    this.transactionQueue.setOnTransactionSent(undefined);
  }

  async stopLater() {
    this.transactionQueue.stopLater();
    this.transactionQueue.setOnTransactionSent(undefined);
  }
}

export default TransactionService;
