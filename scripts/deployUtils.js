
const { deployments, ethers } = require("hardhat");
const fs = require('fs');
const { writeFileSync } = require('fs');
const path = require('path');
const ethersLib = require('ethers');
const chalk = require('chalk');
const Big = require('big.js');
const Web3 = require('web3');
const { readFileSync } = require("fs");
const web3 = new Web3('http://127.0.0.1:7545');


module.exports.deployCharityPoolToNetwork = async ({
    charityName, operatorAddress, charityWalletAddress, holdingTokenAddress, ihelpAddress, swapperAddress, wrappedNativeAddress, priceFeedProvider
}, network) => {
    const FILE_PATH = path.join('deployed-charities', `${network}.json`);

    let deployedCharities = [];

    if (fs.existsSync(FILE_PATH)) {
        const fileData = readFileSync(FILE_PATH, { encoding: 'utf-8' });
        deployedCharities = JSON.parse(fileData);
    }

    const alreadyExists = deployedCharities.find(item => item.charityName === charityName);
    if (alreadyExists) {
        this.yellow(`Chairty ${charityName} was already deployed, skipping...`);
        return;
    }

    const factoryDeployment = await deployments.get("CharityPoolCloneFactory");
    const factory = await ethers.getContractAt("CharityPoolCloneFactory", factoryDeployment.address);

    const tx = await factory.createCharityPool({
        charityName,
        operatorAddress,
        charityWalletAddress,
        holdingTokenAddress,
        ihelpAddress,
        swapperAddress,
        wrappedNativeAddress,
        priceFeedProvider
    });

    const { events } = await tx.wait();
    const charityResult = events.find(Boolean);

    deployedCharities.push({
        charityName,
        address: charityResult.address
    });

    console.log('   deployed:', charityName, '   to address  ', charityResult.address, ' at network :', network);
    console.log(`       charityWalletAddress ${charityWalletAddress}`);

    writeFileSync(FILE_PATH, JSON.stringify(deployedCharities), "UTF-8", { 'flags': 'a+' });

    return charityResult;
};

module.exports.getTokenAddresses = async (currency, lender, chainId) => {

    let ctokenaddress = null;
    let pricefeed = null;
    let tokenaddress = null;

    let addresses = fs.readFileSync(`./networks/${this.chainName(chainId)}-lending.json`, 'utf8');
    addresses = JSON.parse(addresses);

    const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;

    if (isTestEnvironment) {

        if (currency == 'HELP') {
            tokenaddress = (await deployments.getOrNull("iHelp")).address;
            ctokenaddress = null;
            pricefeed = null;
        }
        else {
            tokenaddress = (await deployments.getOrNull(currency)).address;
            ctokenaddress = (await deployments.getOrNull('c' + currency)).address;
            pricefeed = addresses[lender][currency]['priceFeed']
        }

    }
    else {

        if (currency == 'HELP') {
            tokenaddress = (await deployments.getOrNull("iHelp")).address;
            ctokenaddress = null;
            pricefeed = null;
        }
        else {
            tokenaddress = addresses[lender][currency]['underlyingToken']
            ctokenaddress = addresses[lender][currency]['lendingAddress']
            pricefeed = addresses[lender][currency]['priceFeed']
        }

    }

    return {
        "currency": currency,
        "lender": isTestEnvironment ? 'mock' : lender,
        "underlyingToken": tokenaddress,
        "lendingAddress": ctokenaddress,
        "priceFeed": pricefeed
    };

};


module.exports.fromBigNumber = (number, decimals) => {
    if (decimals == undefined) {
        return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)));
    }
    else {
        return parseFloat(ethersLib.utils.formatUnits(number, decimals));
    }
};

module.exports.dim = function () {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.dim.call(chalk, ...arguments));
    }
};

module.exports.cyan = function () {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.cyan.call(chalk, ...arguments));
    }
};

module.exports.yellow = function () {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.yellow.call(chalk, ...arguments));
    }
};

module.exports.green = function () {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.green.call(chalk, ...arguments));
    }
};

module.exports.displayResult = function (name, result) {
    if (!result.newlyDeployed) {
        yellow(`Re-used existing ${name} at ${result.address}`);
    }
    else {
        green(`${name} deployed at ${result.address}`);
    }
};

module.exports.chainName = (chainId) => {
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
            return 'localhost';
        case 43113:
            return 'Fuji';
        case 43114:
            return 'Avalanche';
        case 80001:
            return 'Matic (Mumbai)';
        default:
            return 'Unknown';
    }
};

module.exports.getSwapAddresses = async (dex, chainId) => {
    let addresses = fs.readFileSync(`./networks/${this.chainName(chainId)}-dex.json`);
    addresses = JSON.parse(addresses);
    return addresses[dex];
};

module.exports.getNativeWrapper = async (chainId) => {
    const hardhatContracts = require('../build/hardhat_contracts');
    return hardhatContracts[chainId.toString()][0]['contracts']['WETH']['address'];
}

