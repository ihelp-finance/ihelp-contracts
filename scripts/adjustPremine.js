const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
const axios = require('axios')

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../env/.env') })

let signer;
let ihelp;

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

const adjustPremine = async() => {
    
    let {
        deployer
    } = await hardhat.getNamedAccounts();

    signer = await hardhat.ethers.provider.getSigner(deployer);
    console.log('signer',signer._address);

    const ihelpContract = (await hardhat.deployments.get('iHelp'));
    
    ihelp = await hardhat.ethers.getContractAt("iHelpToken", ihelpContract.address, signer);

    console.log('\nCALLING PREMINE ADJUSTMENT.\n');
    await ihelp.premineAdjustment();

    console.log('\nPREMINE ADJUSTMENT COMPLETE.\n');

    yellow('\nConfirming phases are set and totalSupply is 11m...');

    const phase1tokens = await ihelp.interestPerTokenByPhase(1);
    console.log('Phase 1 Tokens:',hardhat.ethers.utils.formatUnits(phase1tokens.toString(),18));
    // should return 1.66

    const phase11tokens = await ihelp.interestPerTokenByPhase(11);
    console.log('Phase 11 Tokens:',hardhat.ethers.utils.formatUnits(phase11tokens,18));
    // should return 0

    const totalSupply = await ihelp.totalSupply();
    console.log('Total Supply:',hardhat.ethers.utils.formatUnits(totalSupply,18));

    process.exit(0)

}

adjustPremine();
