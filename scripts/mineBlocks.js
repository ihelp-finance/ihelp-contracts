const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')

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

const mineBlocks = async() => {

  const { deploy } = hardhat.deployments;

  let {
    deployer
  } = await hardhat.getNamedAccounts();

  signer = await hardhat.ethers.provider.getSigner(deployer);
  
  const BLOCKS_TO_INCREASE = 1000;

  console.log('\nSTARTING BLOCK MINE OF',BLOCKS_TO_INCREASE,'BLOCKS...');
  
  for (const bi of Array(BLOCKS_TO_INCREASE).keys()) {
    await hardhat.ethers.provider.send("evm_increaseTime", [120])
    await hardhat.ethers.provider.send("evm_mine")
  }

  console.log('\nBLOCK MINE COMPLETE.\n');

}

mineBlocks();