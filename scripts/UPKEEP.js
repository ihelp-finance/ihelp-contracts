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
        stakingPool,
        developmentPool,
        holdingPool,
    } = await hardhat.getNamedAccounts();

    signer = await hardhat.ethers.provider.getSigner(deployer);

    // const charity1walletSigner = await hardhat.ethers.provider.getSigner(charity1wallet);
    // const charity2walletSigner = await hardhat.ethers.provider.getSigner(charity2wallet);
    // const charity3walletSigner = await hardhat.ethers.provider.getSigner(charity3wallet);
    const developmentPoolSigner = await hardhat.ethers.provider.getSigner(developmentPool);
    const stakingPoolSigner = await hardhat.ethers.provider.getSigner(stakingPool);
    const holdingPoolSigner = await hardhat.ethers.provider.getSigner(holdingPool);

    console.log(`\nsigner: ${signer._address}`);
    //console.log(`holder: ${holdingPool}`);

    // get the signer eth balance
    const startbalance = await hardhat.ethers.provider.getBalance(signer._address);
    console.log(`start signer balance: ${fromBigNumber(startbalance)}`);
    
    // const startbalanceholding = await hardhat.ethers.provider.getBalance(holdingPool);
    // console.log(`start holding balance: ${fromBigNumber(startbalanceholding)}`);

    // const currentBlock= await hardhat.ethers.provider.getBlockNumber()

    console.log('\nSTARTING UPKEEP...\n');
    
    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
    ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);
    
    
    const upkeepStatusMapping = {
    0: "dripStage1",
    1: "dripStage2",
    2: "dripStage3",
    3: "dripStage4",
    4: "dump"
  };


  // Incrementally go trough all upkeep steps
  const processUpkeep = async (upkeepStatus) => {
    let newUpkeepstatus = upkeepStatus;
    const method = upkeepStatusMapping[upkeepStatus];
    cyan("Processing upkeep, status ", method);
    while (upkeepStatus == newUpkeepstatus) {
      await ihelp.functions[method]();
      newUpkeepstatus = await ihelp.processingState().then(data => data.status);
    }

    green("New Upkeep status ", newUpkeepstatus.toNumber());

    // Return when the upkeep status goes back to 0
    if (newUpkeepstatus.toNumber() === 0) {
      return;
    }
    await processUpkeep(newUpkeepstatus);
  };


  const upkeepStep = async () => {

    let upkeepStatus = await ihelp.processingState().then(data => data.status);
    await processUpkeep(upkeepStatus);
    
  };
  
  await upkeepStep()
  
  const balanceend = await hardhat.ethers.provider.getBalance(signer._address);
  console.log(`\nend signer balance: ${fromBigNumber(balanceend)}`);
  
  // const endbalanceholding = await hardhat.ethers.provider.getBalance(holdingPool);
  // console.log(`end holding balance: ${fromBigNumber(endbalanceholding)}`);
  
  console.log(`signer cost:`,fromBigNumber(startbalance)-fromBigNumber(balanceend));
  //console.log(`holder cost:`,fromBigNumber(startbalanceholding)-fromBigNumber(endbalanceholding));
  
  console.log('\nUPKEEP COMPLETE.\n');
    
  /*
    const { Webhook } = require('discord-webhook-node');
    const hook = new Webhook("");
     
    const IMAGE_URL = 'https://avalanche.ihelp.finance/assets/ihelp_icon.png';
    hook.setUsername('iHelp Job Monitor');
    hook.setAvatar(IMAGE_URL);
     
    hook.send("Upkeep Job Completed Successfully...\n   Signer Cost: "+signerCost.toFixed(4)+'\n   Holder Cost: '+holderCost.toFixed(4)+'\n   Signer Balance: '+fromBigNumber(balanceend).toFixed(4)+'\n   Holder Balance: '+fromBigNumber(endbalanceholding).toFixed(4));

  */
    
}

upkeep();