const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
// const externalContracts = require('../../react-app/src/contracts/external_contracts');

const { chainName, green, yellow, dim, fromBigNumber, getLendingConfigurations, cyan,runRpcTest } = require("./deployUtils");

const db = require('../../ihelp-app/config/db.js');

//const { assert, use, expect } = require("chai");

let userAccount, userSigner;
let signer;
let ihelp, xhelp, swapper, charityPool1, charityPool2, charityPool3, dai, cdai;

const reward = async() => {

    await runRpcTest();

    const { deploy } = hardhat.deployments;

    let {
        deployer,
        stakingPool,
    } = await hardhat.getNamedAccounts();

    const nodeUrlWs = process.env.WEBSOCKET_RPC_URL;
    if (nodeUrlWs == '' || nodeUrlWs == undefined) {
        console.log('please define WEBSOCKET_RPC_URL env variable - exiting')
        process.exit(1)
    }
    
    const provider = new ethers.providers.WebSocketProvider(nodeUrlWs)

    signer = await provider.getSigner(deployer);

    console.log(`signer: ${deployer}`);

    // get the signer eth balance
    const startbalance = await provider.getBalance(signer._address);
    console.log(`start signer balance: ${fromBigNumber(startbalance)}`);
    
    const helpAddress = (await hardhat.deployments.get('iHelp')).address;
    help = await hardhat.ethers.getContractAt('iHelpToken', helpAddress, signer);

    const xhelpAddress = (await hardhat.deployments.get('xHelp')).address;
    xhelp = await hardhat.ethers.getContractAt('xHelpToken', xhelpAddress, signer);

    const analyticsAddress = (await hardhat.deployments.get('analytics')).address;
    analytics = await hardhat.ethers.getContractAt('Analytics', analyticsAddress, signer);

    let dai,cdai,usdc,cusdc;

    const mainnetInfura = new ethers.providers.StaticJsonRpcProvider(process.env.REACT_APP_RPC_URL);

    const stakepool1Tx = await xhelp.totalAwarded();
    const stakepool1 = fromBigNumber(stakepool1Tx);
    console.log('\nStart Awarded:',stakepool1)

    let stakepool2 = parseFloat(stakepool1);
    
    // if (parseFloat(stakepool) > 0) {
    
    const calcRewardsTx = await xhelp.distributeRewards();
    await calcRewardsTx.wait();
    
    const stakepool2Tx = await xhelp.totalAwarded();
    stakepool2 = fromBigNumber(stakepool2Tx);
    console.log('\nEnd Awarded:',stakepool2)
    
    const newlyAwarded = parseFloat(stakepool2) - parseFloat(stakepool1)
    console.log('\nNewly Awarded:',newlyAwarded.toFixed(6))

    const helpCirculatingTx = await help.totalCirculating();
    const helpCirculating = fromBigNumber(helpCirculatingTx);
    console.log('\nhelpCirculating:',helpCirculating)

    const helpSupplyTx = await help.totalSupply();
    const helpSupply = fromBigNumber(helpSupplyTx);
    console.log('\nhelpSupply:',helpSupply)

    const xhelpSupplyTx = await xhelp.totalSupply();
    const xhelpSupply = fromBigNumber(xhelpSupplyTx);
    console.log('\nxhelpSupply:',xhelpSupply)

    let totalHelpers=0;
    let totalCharities=0;
    let totalInterest=0;
    let totalTvl=0;
    let totalDirectDonations=0;

    let numberOfCharities = await help.numberOfCharities()
    numberOfCharities = parseInt(numberOfCharities.toString());
    console.log('\nnumberOfCharities',numberOfCharities);

    const BATCH_SIZE = 15;
    let index = 0;
    for (let i = index; i < numberOfCharities; i = i + BATCH_SIZE) {
        // console.log(i,'/',numberOfCharities)

        const d = await analytics["generalStats"](helpAddress, i, BATCH_SIZE)
        // console.log(d)
        
        // make this non-additive due to calling outside limit paganation
        totalHelpers = parseFloat(d['totalHelpers'])
        
        // increment these values from paganation
        totalCharities += parseFloat(d['totalCharities'])
        totalInterest += parseFloat(ethers.utils.formatUnits(d['totalInterestGenerated'], 18))
        totalTvl += parseFloat(ethers.utils.formatUnits(d['totalValueLocked'], 18))
        totalDirectDonations += parseFloat(ethers.utils.formatUnits(d['totalDirectDonations'], 18))

    }
    
    const data = {
        reward:newlyAwarded,
        total_reward:stakepool2,
        help_circulating:helpCirculating.toFixed(6),
        help_supply:helpSupply.toFixed(6),
        xhelp_supply:xhelpSupply.toFixed(6),
        tvl:totalTvl.toFixed(6),
        interest_generated:totalInterest.toFixed(6),
        direct_donations:totalDirectDonations.toFixed(6),
        num_charities:totalCharities.toFixed(0),
        num_donors:totalHelpers.toFixed(0),
    }
    console.log('');
    console.log(data);
    
    if (newlyAwarded > 0) {
        await db.StakingStat.create(data)
    } else {
        console.log('no reward - not saving stats...');
    }

    // }
    
    const balanceend = await provider.getBalance(signer._address);
    console.log(`\nend signer balance: ${fromBigNumber(balanceend)}`);

    const signerCost = fromBigNumber(startbalance)-fromBigNumber(balanceend);

    console.log(`signer cost:`,signerCost);

    console.log('\nREWARD DISTRIBUTION COMPLETE.\n');
    
    if (process.env.DISCORD_WEBOOK != undefined && process.env.DISCORD_WEBOOK != '') {
      const { Webhook } = require('discord-webhook-node');
      const hook = new Webhook(process.env.DISCORD_WEBOOK);
       
      const IMAGE_URL = 'https://ihelp.finance/assets/ihelp_icon.png';
      hook.setUsername('iHelp Job Monitor');
      hook.setAvatar(IMAGE_URL);
       
      await hook.send("Reward Job Completed Successfully...\n   Signer Cost: "+signerCost.toFixed(4)+'\n   Signer Balance: '+fromBigNumber(balanceend).toFixed(4) +'\n   Newly Awarded:' + newlyAwarded.toFixed(6));
    }
      
    process.exit(0)

}

reward();