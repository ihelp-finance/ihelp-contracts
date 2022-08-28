const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')

const { getChainId, network } = require('hardhat');
const { chainName, green, yellow, dim, fromBigNumber, getLendingConfigurations, cyan } = require("./deployUtils");

const upkeep = async() => {

  const { deploy } = hardhat.deployments;

  let {
    deployer
  } = await hardhat.getNamedAccounts();

  signer = await hardhat.ethers.provider.getSigner(deployer);

  console.log(`\nsigner: ${signer._address}`);

  const daiAbi = require('./utils/dai.abi.json');
  const configs = await getLendingConfigurations();
  let daiAddress = null;
  Object.keys(configs).map((c)=>{
    Object.keys(configs[c]).map((cc)=>{
      if (cc.indexOf('DAI') > -1) {
        daiAddress = configs[c][cc]['underlyingToken'];
      }
    })
  })

  const DAI = new ethers.Contract(daiAddress, daiAbi, hardhat.ethers.provider);

  const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
  ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);
  
  const developmentPool = await ihelp.developmentPool();
  const stakingPool = await ihelp.stakingPool();
  console.log('devpool:',developmentPool)
  console.log('stakingpool:',stakingPool)

  const analyticsAddress = (await hardhat.deployments.get('analytics')).address;
  analytics = await hardhat.ethers.getContractAt('Analytics', analyticsAddress, signer);

  // get the signer eth balance
  const startbalance = await hardhat.ethers.provider.getBalance(signer._address);
  console.log(`\nstart signer balance: ${fromBigNumber(startbalance)}`);

  const numberOfCharities = await ihelp.numberOfCharities();
  const BATCH_SIZE = 30;

  let index = 0;
  let startinterest = 0;
  for (let i = index; i < numberOfCharities; i = i + BATCH_SIZE) {
    // console.log(i,'/',parseInt(numberOfCharities));
    const d = await analytics.generalStats(ihelpAddress,i, BATCH_SIZE);
    startinterest += parseFloat(hardhat.ethers.utils.formatUnits(d['totalInterestGenerated'], 18))
  }

  console.log(`start interest gen: ${startinterest}`);

  const daiDevBalanceStart = await DAI.balanceOf(developmentPool);
  console.log(`start dai dev balance: ${fromBigNumber(daiDevBalanceStart)}`);

  const daiStakingBalanceStart = await DAI.balanceOf(stakingPool);
  console.log(`start dai stake balance: ${fromBigNumber(daiStakingBalanceStart)}`);

  console.log('\nSTARTING UPKEEP...');

  // console.log('\nsetting lower gas limit to 6.5m');
  // await ihelp.setProcessingGasLimit('6500000');
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
    console.log(await ihelp.processingState());
   //console.log();

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
    
    console.log('upkeepStatus',upkeepStatus);
    
    // console.log('\nresetting processing state');
    // await ihelp.setProcessingState(0,0,0,0,0,0,0);
    // console.log('processing state reset\n');
    
    // process.exit(0)
    
    await processUpkeep(upkeepStatus);

  };

  await upkeepStep()

  const balanceend = await hardhat.ethers.provider.getBalance(signer._address);
  console.log(`\nend signer balance: ${fromBigNumber(balanceend)}`);

  const signerCost = fromBigNumber(startbalance) - fromBigNumber(balanceend);

  console.log(`signer cost:`, signerCost);
  console.log();

  index = 0;
  let endinterest = 0;
  for (let i = index; i < numberOfCharities; i = i + BATCH_SIZE) {
    // console.log(i,'/',parseInt(numberOfCharities));
    const d = await analytics.generalStats(ihelpAddress,i, BATCH_SIZE);
    endinterest += parseFloat(hardhat.ethers.utils.formatUnits(d['totalInterestGenerated'], 18))
  }
  console.log(`end interest gen: ${endinterest}`);

  const daiDevBalanceEnd = await DAI.balanceOf(developmentPool);
  console.log(`end dai dev balance: ${fromBigNumber(daiDevBalanceEnd)}`);

  const daiStakingBalanceEnd = await DAI.balanceOf(stakingPool);
  console.log(`end dai stake balance: ${fromBigNumber(daiStakingBalanceEnd)}`);
  console.log();
  
  const totalGenerated = endinterest - startinterest;
  console.log(`total interest generated:`, totalGenerated);

  const devGenerated = fromBigNumber(daiDevBalanceEnd) - fromBigNumber(daiDevBalanceStart);
  const stakeGenerated = fromBigNumber(daiStakingBalanceEnd) - fromBigNumber(daiStakingBalanceStart);
  const charityGenerated = totalGenerated - devGenerated - stakeGenerated;
  
  console.log(`charity interest generated:`, charityGenerated, '->',((charityGenerated/totalGenerated)*100).toFixed(3)+'%');
  console.log(`dev interest generated:`, devGenerated, '->',((devGenerated/totalGenerated)*100).toFixed(3)+'%');
  console.log(`stake interest generated:`,stakeGenerated, '->' ,((stakeGenerated/totalGenerated)*100).toFixed(3)+'%');

  console.log('\nUPKEEP COMPLETE.\n');

  if (process.env.DISCORD_WEBOOK != undefined && process.env.DISCORD_WEBOOK != '') {
    const { Webhook } = require('discord-webhook-node');
    const hook = new Webhook(process.env.DISCORD_WEBOOK);

    const IMAGE_URL = 'https://ihelp.finance/assets/ihelp_icon.png';
    hook.setUsername('iHelp Job Monitor');
    hook.setAvatar(IMAGE_URL);

    await hook.send("Upkeep Job Completed Successfully...\n   Signer Cost: " + signerCost.toFixed(4) + '\n   Signer Balance: ' + fromBigNumber(balanceend).toFixed(4) + '\n   Total Interest Generated: ' + totalGenerated.toFixed(4)) ;
  }

  process.exit(0)

}

upkeep();