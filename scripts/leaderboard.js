const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')

let signer;
let analytics;

const fromBigNumber = (number) => {
    return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)))
}

function dim() {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.dim.call(chalk, ...arguments))
    }
}

function yellow() {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.yellow.call(chalk, ...arguments))
    }
}

function green() {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.green.call(chalk, ...arguments))
    }
}

function cyan() {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.cyan.call(chalk, ...arguments))
    }
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
        deployer
    } = await hardhat.getNamedAccounts();

    signer = await hardhat.ethers.provider.getSigner(deployer);

    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
    ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);

    const analyticsAddress = (await hardhat.deployments.get('analytics')).address;
    analytics = await hardhat.ethers.getContractAt('Analytics', analyticsAddress, signer);
    
    // this leaderboard collection will get both users
    
    const charityPoolsWithContributions = await analytics.getCharityPoolsWithContributions(ihelpAddress,0,1000);
    
    console.log(charityPoolsWithContributions)

    console.log('\nLEADERBOARD COLLECTION COMPLETE.\n');
    
    
    // const { Webhook } = require('discord-webhook-node');
    // const hook = new Webhook("");
     
    // const IMAGE_URL = 'https://avalanche.ihelp.finance/assets/ihelp_icon.png';
    // hook.setUsername('iHelp Job Monitor');
    // hook.setAvatar(IMAGE_URL);
     
    // hook.send("Reward Job Completed Successfully...\n   Signer Cost: "+signerCost.toFixed(4)+'\n   Staking Cost: '+stakerCost.toFixed(4)+'\n   Signer Balance: '+fromBigNumber(balanceend).toFixed(4)+'\n   Staker Balance: '+fromBigNumber(endbalancestaking).toFixed(4) +'\nNewly Awarded:' + (parseFloat(stakepool2) - parseFloat(stakepool1)).toFixed(6));


}

upkeep();