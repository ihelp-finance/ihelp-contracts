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

    signer = await hardhat.ethers.provider.getSigner(deployer);

    console.log(`signer: ${deployer}`);

    // get the signer eth balance
    const startbalance = await hardhat.ethers.provider.getBalance(signer._address);
    console.log(`start signer balance: ${fromBigNumber(startbalance)}`);
    
    const xhelpAddress = (await hardhat.deployments.get('xHelp')).address;
    xhelp = await hardhat.ethers.getContractAt('xHelpToken', xhelpAddress, signer);

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
    
    const data = {
        reward:newlyAwarded,
        total_reward:stakepool2 
    }
    
    if (newlyAwarded > 0) {
        await db.StakingStat.create(data)
    }

    // }
    
    const balanceend = await hardhat.ethers.provider.getBalance(signer._address);
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