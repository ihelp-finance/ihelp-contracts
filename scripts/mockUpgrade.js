const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')

if (process.argv.length < 2) {
  console.log('Please provide a positional argument of the raw data to upgrade...')
  process.exit(1)
}

let upgradeBatchFile;
try {
  upgradeBatchFile = fs.readFileSync(process.argv[2], 'utf8')
}catch(e){
  console.log('no update batch to process...')
  process.exit(0)
}

const upgradeBatch = JSON.parse(upgradeBatchFile)

function dim() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.dim.call(chalk, ...arguments));
  }
}

function cyan() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.cyan.call(chalk, ...arguments));
  }
}

function yellow() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.yellow.call(chalk, ...arguments));
  }
}

function green() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.green.call(chalk, ...arguments));
  }
}

const fromBigNumber = (number) => {
  return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)))
}


const chainName = (chainId) => {
  switch (chainId) {
    case 1:
      return 'Mainnet';
    case 3:
      return 'Ropsten';
    case 4:
      return 'Rinkeby';
    case 5:
      return 'Goerli';
    case 42:
      return 'Kovan';
    case 56:
      return 'Binance Smart Chain';
    case 77:
      return 'POA Sokol';
    case 97:
      return 'Binance Smart Chain (testnet)';
    case 99:
      return 'POA';
    case 100:
      return 'xDai';
    case 137:
      return 'Matic';
    case 31337:
      return 'HardhatEVM';
    case 43113:
      return 'Fuji';
    case 43114:
      return 'Avalanche';
    case 80001:
      return 'Matic (Mumbai)';
    default:
      return 'Unknown';
  }
}

let signer;

const mockUpgrade = async() => {

  cyan('\nStarting Impersonated Upgrade...\n')

  const proxyAdminOwner = process.env.PROXY_ADMIN_OWNER;
  yellow('proxyAdminOwner', proxyAdminOwner)

  await hardhat.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [proxyAdminOwner],
  });
  const signer = await hardhat.ethers.provider.getSigner(proxyAdminOwner);
  
  const balance = await signer.getBalance();
  console.log('   proxyAdmin Balance:', fromBigNumber(balance))

  if (balance == 0) {
    console.log('   sending proxy admin some funds')
    let {
      deployer,
    } = await hardhat.getNamedAccounts();

    deployer_signer = await hardhat.ethers.provider.getSigner(deployer);

    let tx = {
      to: proxyAdminOwner,
      value: ethers.utils.parseEther('1')
    }
    await deployer_signer.sendTransaction(tx)

    yellow('   New ProxyAdmin Balance:', fromBigNumber(await signer.getBalance()))

  }

  for (let i = 0; i < upgradeBatch['transactions'].length; i++) {

    const tx = upgradeBatch['transactions'][i];

    cyan('\nupgrading', i + 1, '/', upgradeBatch['transactions'].length)

    console.log('submitting:', tx)

    const t = await signer.sendTransaction(tx)

  }

  green('\nupgrade complete\n')

}
mockUpgrade()