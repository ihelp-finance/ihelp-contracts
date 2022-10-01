const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')

const { getChainId, network } = require('hardhat');
const { chainName, green, yellow, dim, fromBigNumber, getLendingConfigurations, cyan,runRpcTest } = require("./deployUtils");

const upkeep = async() => {

  await runRpcTest();

  const nodeUrlWs = process.env.WEBSOCKET_RPC_URL;
  if (nodeUrlWs == '' || nodeUrlWs == undefined) {
      console.log('please define WEBSOCKET_RPC_URL env variable - exiting')
      process.exit(1)
  }
  
  const provider = new ethers.providers.WebSocketProvider(nodeUrlWs)

  let privKey = process.env.DEPLOYER_PRIVATE_KEY;
  const signer = new ethers.Wallet(privKey, provider);

  console.log(`signer: ${signer.address}`);

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

  const DAI = new ethers.Contract(daiAddress, daiAbi, provider);

  const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
  ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);
  
  const developmentPool = await ihelp.developmentPool();
  const stakingPool = await ihelp.stakingPool();
  console.log('devpool:',developmentPool)
  console.log('stakingpool:',stakingPool)

  const analyticsAddress = (await hardhat.deployments.get('analytics')).address;
  analytics = await hardhat.ethers.getContractAt('Analytics', analyticsAddress, signer);

  // get the signer eth balance
  const startbalance = await provider.getBalance(signer.address);
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

  // console.log(`start interest gen: ${startinterest}`);

  const daiDevBalanceStart = await DAI.balanceOf(developmentPool);
  console.log(`start dai dev balance: ${fromBigNumber(daiDevBalanceStart)}`);

  const daiStakingBalanceStart = await DAI.balanceOf(stakingPool);
  console.log(`start dai stake balance: ${fromBigNumber(daiStakingBalanceStart)}`);

  console.log('\nSTARTING UPKEEP...');

  // console.log('\nsetting lower gas limit to 6.5m');
  // await ihelp.setProcessingGasLimit('6500000');
  // console.log('gas limit set\n');

  // run the upkeep process
  console.log('\nrunning upkeep function');
  const upkeepTx = await ihelp.upkeep();
  await upkeepTx.wait(1);

  // increment the total interest earned manually until we make this a view
  console.log('\nincrementing interest counters');

  const charities = await ihelp.getCharities();

  const charitiesToProcess = [];
  for (const [ci,charityAddress] of charities.entries()) {
    const charity = await hardhat.ethers.getContractAt('CharityPool', charityAddress, signer);
    if (await charity.accountedBalanceUSD() > 0) {
      charitiesToProcess.push(charity.address);
    }
  }

  const CHARITY_BATCH_SIZE = 16;

  console.log(charitiesToProcess.length,'charities to incremental interest in batches of',CHARITY_BATCH_SIZE);

  let counter = 0;
  for (let i=0;i<charitiesToProcess.length;i=i+CHARITY_BATCH_SIZE) {
    console.log('increment',i,i+CHARITY_BATCH_SIZE);
    const batch = charitiesToProcess.slice(i, i+CHARITY_BATCH_SIZE);

    const incrementTx = await ihelp.incrementTotalInterest(batch);
    await incrementTx.wait(1);

    for (const i of batch) {
      counter+=1
    }

  }
  console.log(counter,'charities incremented\n');

  const balanceend = await provider.getBalance(signer.address);
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