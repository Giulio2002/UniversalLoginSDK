import {expect} from 'chai';
import {utils} from 'ethers';
import {ACTION_KEY, createSignedMessage} from '@universal-login/commons';
import {transferMessage, addKeyMessage, removeKeyMessage} from '../../../fixtures/basicWalletContract';
import setupTransactionService from '../../../helpers/setupTransactionService';
import defaultDeviceInfo from '../../../config/defaults';
import {getKnex} from '../../../../lib/utils/knexUtils';

describe('Relayer - MessageHandler', async () => {
  let messageHandler;
  let provider;
  let authorisationService;
  let wallet;
  let mockToken;
  let walletContract;
  let msg;
  let otherWallet;
  const knex = getKnex();

  beforeEach(async () => {
    ({wallet, provider, messageHandler, mockToken, authorisationService, walletContract, otherWallet} = await setupTransactionService(knex));
    msg = {...transferMessage, from: walletContract.address, gasToken: mockToken.address};
  });

  it('Error when not enough tokens', async () => {
    const message = {...msg, gasLimit: utils.parseEther('2.0')};
    const signedMessage = await createSignedMessage(message, wallet.privateKey);
    expect(messageHandler.executeSigned(signedMessage))
      .to.be.eventually.rejectedWith('Not enough tokens');
  });

  it('Error when not enough gas', async () => {
    const message = {...msg, gasLimit: 100};
    const signedMessage = await createSignedMessage(message, wallet.privateKey);
    await expect(messageHandler.executeSigned(signedMessage)).to.be.rejectedWith('Not enough gas');
  });

  describe('Transfer', async () => {
    it('successful execution of transfer', async () => {
      const expectedBalance = (await provider.getBalance(msg.to)).add(msg.value);
      const signedMessage = await createSignedMessage(msg, wallet.privateKey);
      await messageHandler.executeSigned(signedMessage);
      expect(await provider.getBalance(msg.to)).to.eq(expectedBalance);
    });
  });

  describe('Add Key', async () => {
    it('execute add key', async () => {
      msg = {...addKeyMessage, from: walletContract.address, gasToken: mockToken.address, to: walletContract.address};
      const signedMessage = await createSignedMessage(msg, wallet.privateKey);

      await messageHandler.executeSigned(signedMessage);
      expect(await walletContract.getKeyPurpose(otherWallet.address)).to.eq(ACTION_KEY);
    });

    describe('Collaboration with Authorisation Service', async () => {
      it('should remove request from pending authorisations if addKey', async () => {
        const request = {walletContractAddress: walletContract.address, key: otherWallet.address, deviceInfo: defaultDeviceInfo};
        await authorisationService.addRequest(request);
        msg = {...addKeyMessage, from: walletContract.address, gasToken: mockToken.address, to: walletContract.address};
        const signedMessage = await createSignedMessage(msg, wallet.privateKey);
        await messageHandler.executeSigned(signedMessage);
        const authorisations = await authorisationService.getPendingAuthorisations(walletContract.address);
        expect(authorisations).to.deep.eq([]);
      });
    });
  });

  describe('Remove key ', async () => {
    beforeEach(async () => {
      const message =  {...addKeyMessage, from: walletContract.address, gasToken: mockToken.address, to: walletContract.address};
      const signedMessage = await createSignedMessage(message, wallet.privateKey);

      await messageHandler.executeSigned(signedMessage);
    });

    it('should remove key', async () => {
      expect((await walletContract.getKeyPurpose(otherWallet.address))).to.eq(ACTION_KEY);
      const message =  {...removeKeyMessage, from: walletContract.address, gasToken: mockToken.address, to: walletContract.address};
      const signedMessage = await createSignedMessage(message, wallet.privateKey);

      await messageHandler.executeSigned(signedMessage);
      expect((await walletContract.keyExist(otherWallet.address))).to.eq(false);
    });
  });

  after(async () => {
    await knex.delete().from('authorisations');
    await knex.destroy();
  });
});


