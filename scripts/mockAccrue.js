const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
// const externalContracts = require('../../ihelp-app/client/src/contracts/external_contracts');

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

let userAccount, userSigner;
let signer;
let ihelp,cDAI,cUSDC,dai,USDC,charityPool1,charityPool2,charityPool3;

const mockAccrue = async() => {

  const { deploy } = hardhat.deployments;

  let {
    deployer,
    stakingPool,
    developmentPool,
    holdingPool,
  } = await hardhat.getNamedAccounts();

  signer = await hardhat.ethers.provider.getSigner(deployer);

  const developmentPoolSigner = await hardhat.ethers.provider.getSigner(developmentPool);
  const stakingPoolSigner = await hardhat.ethers.provider.getSigner(stakingPool);
  const holdingPoolSigner = await hardhat.ethers.provider.getSigner(holdingPool);

  console.log(`\nsigner: ${signer._address}`);

  // get the signer eth balance
  const startbalance = await hardhat.ethers.provider.getBalance(signer._address);
  console.log(`start signer balance: ${fromBigNumber(startbalance)}`);

  console.log('\nSTARTING MOCK ACCURAL...\n');

  const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
  ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);
  
  const daiAddress = (await hardhat.deployments.get('DAI')).address;
  dai = await hardhat.ethers.getContractAt('ERC20MintableMock', daiAddress, signer);
  
  const cdaiAddress = (await hardhat.deployments.get('cDAI')).address;
  cdai = await hardhat.ethers.getContractAt('CTokenMock', cdaiAddress, signer);
  
  const usdcAddress = (await hardhat.deployments.get('USDC')).address;
  usdc = await hardhat.ethers.getContractAt('ERC20MintableMock', usdcAddress, signer);
  
  const cusdcAddress = (await hardhat.deployments.get('cUSDC')).address;
  cusdc = await hardhat.ethers.getContractAt('CTokenMock', cusdcAddress, signer);
  
  const charityPool1Address = (await hardhat.deployments.get('charityPool1')).address;
  charityPool1 = await hardhat.ethers.getContractAt('CharityPool', charityPool1Address, signer);

  const charityPool2Address = (await hardhat.deployments.get('charityPool2')).address;
  charityPool2 = await hardhat.ethers.getContractAt('CharityPool', charityPool2Address, signer);
  
  const charityPool3Address = (await hardhat.deployments.get('charityPool3')).address;
  charityPool3 = await hardhat.ethers.getContractAt('CharityPool', charityPool3Address, signer);

  const calculateAccrualValueDai = async(value) => {

    const c1bTx = await cdai.balanceOfUnderlying(charityPool1.address);
    const c1b = (c1bTx.toString());
    const c2bTx = await cdai.balanceOfUnderlying(charityPool2.address);
    const c2b = (c2bTx.toString());
    const c3bTx = await cdai.balanceOfUnderlying(charityPool3.address);
    const c3b = (c3bTx.toString());
    //console.log('c2b', c2b);

    const totalb = Big(c1b).plus(c2b).plus(c3b);
    
    //console.log('totalb', totalb.toFixed(0));

    const getCashTx = await cdai.getCash();
    const getCash = getCashTx.toString();
    console.log('getCashDai', getCash);

    let accrualValue = null;
    let percentofcdai = null;
    
    if (getCash != 0) {
      percentofcdai = totalb.times(1e18).div(getCash);
      accrualValue = web3.utils.toWei(Big(value).times(1e18).div(percentofcdai).toFixed(0));
    }else {
      percentofcdai = 0;
      accrualValue = 0;
    }
    console.log('percentCDAI', percentofcdai.toFixed(0));
    console.log('accrualValue', accrualValue);

    return accrualValue;

  };

  const calculateAccrualValueUsdc = async(value) => {

    const c1bTx = await cusdc.balanceOfUnderlying(charityPool1.address);
    const c1b = (c1bTx.toString());
    const c2bTx = await cusdc.balanceOfUnderlying(charityPool2.address);
    const c2b = (c2bTx.toString());
    const c3bTx = await cusdc.balanceOfUnderlying(charityPool3.address);
    const c3b = (c3bTx.toString());
    //console.log('c2b', c2b);

    const totalb = Big(c1b).plus(c2b).plus(c3b);
    //console.log('totalb', totalb.toFixed(0));

    const getCashTx = await cusdc.getCash();
    const getCash = getCashTx.toString();
    console.log('getCashUsdc', getCash);

    let accrualValue = null;
    let percentofcusdc = null;
    
    if (getCash != 0) {
      percentofcusdc = totalb.times(1e6).div(getCash);
      accrualValue = ethers.utils.parseUnits(Big(value).times(1e6).div(percentofcusdc).toFixed(0), usdcDecimals).toString();
    }else {
      percentofcusdc = 0;
      accrualValue = 0;
    }
    console.log('percentCUSDC', percentofcusdc.toFixed(0));
    console.log('accrualValue', accrualValue);

    return accrualValue;

  };
  
  const daiDecimals = await dai.decimals();
  const usdcDecimals = await usdc.decimals();

  // accrue DAI
  const aval1 = await calculateAccrualValueDai(100000);
  const accrueTxDai1 = await cdai.accrueCustom(aval1);
  await accrueTxDai1.wait();

  // accrue USDC
  const aval2 = await calculateAccrualValueUsdc(100000);
  const accrueTxUsdc1 = await cusdc.accrueCustom(aval2);
  await accrueTxUsdc1.wait();

  const balanceend = await hardhat.ethers.provider.getBalance(signer._address);
  console.log(`\nend signer balance: ${fromBigNumber(balanceend)}`);

  console.log(`signer cost:`, fromBigNumber(startbalance) - fromBigNumber(balanceend));

  console.log('\nMOCK ACCRUAL COMPLETE.\n');

}

mockAccrue();