import {utils, Contract} from 'ethers';

const addressToBytes32 = (address) =>
  utils.padZeros(utils.arrayify(address), 32);

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitForContractDeploy = async (providerOrWallet, contractJSON, transactionHash) => {
  const {abi} = contractJSON;
  const receipt = await waitForTransactionReceipt(providerOrWallet, transactionHash);
  return new Contract(receipt.contractAddress, abi, providerOrWallet);
};

const waitForTransactionReceipt = async (providerOrWallet, transactionHash, tick = 1000) => {
  const provider = providerOrWallet.provider ? providerOrWallet.provider : providerOrWallet;
  let receipt = await provider.getTransactionReceipt(transactionHash);
  do {
    receipt = await provider.getTransactionReceipt(transactionHash);
    await sleep(tick);
  } while (!receipt || !receipt.blockHash);
  return receipt;
};

export {waitForContractDeploy, addressToBytes32, sleep, waitForTransactionReceipt};
