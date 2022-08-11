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

let userAccount, userSigner;
let signer;
let ihelp;

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


const upkeep = async() => {

  const { deploy } = hardhat.deployments;

  let {
    deployer,
  } = await hardhat.getNamedAccounts();

  signer = await hardhat.ethers.provider.getSigner(deployer);

  console.log(`\nsigner: ${signer._address}`);

  // get the signer eth balance
  const startbalance = await hardhat.ethers.provider.getBalance(signer._address);
  console.log(`start signer balance: ${fromBigNumber(startbalance)}`);

  console.log('\nSTARTING UPKEEP...');

  const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
  ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);

  // console.log('\nsetting lower gas limit');
  // await ihelp.setProcessingGasLimit('7000000');
  // console.log('gas limit set\n');

  const upkeepStatusMapping = {
    0: "dripStage1",
    1: "dripStage2",
    2: "dripStage3",
    3: "dripStage4",
    4: "dump"
  };

  let lastStep = 0;

  // Incrementally go trough all upkeep steps
  const processUpkeep = async(upkeepStatus) => {

    lastStep = JSON.parse(JSON.stringify(upkeepStatus.toNumber()));

    let newUpkeepstatus = upkeepStatus;
    const method = upkeepStatusMapping[upkeepStatus];

    const numberOfCharities = await ihelp.numberOfCharities()

    cyan("\nProcessing upkeep:", method);

    while (upkeepStatus == newUpkeepstatus) {
      
      if (method == 'dripStage1') {
        const charityIndex = await ihelp.processingState().then(data => data.i);
        green("   running", method,'-',parseInt(charityIndex)+1,'/',parseInt(numberOfCharities));
      } else {
        green("   running", method);
      }
      
      // process.exit(0)
      
      tx = await ihelp.functions[method]();

      const { status } = await tx.wait(1);

      if (+status != 1) {
        process.exit(1);
      }

      newUpkeepstatus = await ihelp.processingState().then(data => data.status);
      yellow('   new status:', upkeepStatusMapping[newUpkeepstatus]);
    }

    // Return when the upkeep status goes back to dripStage1 step 0 from dump step 4
    if (newUpkeepstatus.toNumber() == 0 && lastStep == 4) {
      cyan('\nProcessing complete...')
      return
    }
    else {
      await processUpkeep(newUpkeepstatus);
    }
  };

  const upkeepStep = async() => {

    let upkeepStatus = await ihelp.processingState().then(data => data.status);
    await processUpkeep(upkeepStatus);

  };

  await upkeepStep()

  const balanceend = await hardhat.ethers.provider.getBalance(signer._address);
  console.log(`\nend signer balance: ${fromBigNumber(balanceend)}`);

  // const endbalanceholding = await hardhat.ethers.provider.getBalance(holdingPool);
  // console.log(`end holding balance: ${fromBigNumber(endbalanceholding)}`);

  const signerCost = fromBigNumber(startbalance) - fromBigNumber(balanceend);

  console.log(`signer cost:`, signerCost);

  console.log('\nUPKEEP COMPLETE.\n');

  if (process.env.DISCORD_WEBOOK != undefined && process.env.DISCORD_WEBOOK != '') {
    const { Webhook } = require('discord-webhook-node');
    const hook = new Webhook(process.env.DISCORD_WEBOOK);

    const IMAGE_URL = 'https://ihelp.finance/assets/ihelp_icon.png';
    hook.setUsername('iHelp Job Monitor');
    hook.setAvatar(IMAGE_URL);

    await hook.send("Upkeep Job Completed Successfully...\n   Signer Cost: " + signerCost.toFixed(4) + '\n   Signer Balance: ' + fromBigNumber(balanceend).toFixed(4));
  }

  process.exit(0)

}

upkeep();