
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
    charityName, operatorAddress, holdingPoolAddress, charityWalletAddress, holdingTokenAddress, ihelpAddress, swapperAddress, stakingPoolAddress, developmentPoolAddress, wrappedNativeAddress, priceFeedProvider
}, network) => {
    const FILE_PATH = path.join('deployed-charities', `${network}.json`);

    let deployedCharities = [];

    if (fs.existsSync(FILE_PATH)) {
        const fileData = readFileSync(FILE_PATH, { encoding: 'utf-8' });
        deployedCharities = JSON.parse(fileData);
    }

    const factoryDeployment = await deployments.get("CharityPoolCloneFactory");
    const factory = await ethers.getContractAt("CharityPoolCloneFactory", factoryDeployment.address);

    const tx = await factory.createCharityPool({
        charityName,
        operatorAddress,
        holdingPoolAddress,
        charityWalletAddress,
        holdingTokenAddress,
        ihelpAddress,
        swapperAddress,
        stakingPoolAddress,
        developmentPoolAddress,
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
    console.log(`       holdingToken ${holdingTokenAddress}`);
    console.log(`       holdingPool ${holdingPoolAddress}`);
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

        if (currency == 'DAI') {
            tokenaddress = (await deployments.getOrNull("DAI")).address;
            ctokenaddress = (await deployments.getOrNull("cDAI")).address;
            pricefeed = addresses[lender]['PriceOracleProxy']['DAI'];
        }
        else if (currency == 'USDC') {
            tokenaddress = (await deployments.getOrNull("USDC")).address;
            ctokenaddress = (await deployments.getOrNull("cUSDC")).address;
            pricefeed = addresses[lender]['PriceOracleProxy']['USDC'];
        }
        else if (currency == 'WETH') {
            tokenaddress = (await deployments.getOrNull("WETH")).address;
            ctokenaddress = null;
            pricefeed = addresses[lender]['PriceOracleProxy']['WETH'];
        }
        else if (currency == 'HELP') {
            tokenaddress = (await deployments.getOrNull("iHelp")).address;
            ctokenaddress = null;
            pricefeed = null;
        }

    }
    else {

        if (currency == 'DAI') {
            tokenaddress = addresses[lender]['Tokens']['DAI'];
            ctokenaddress = addresses[lender]['lendingTokens']['DAI'];
            pricefeed = addresses[lender]['PriceOracleProxy']['DAI'];
        }
        else if (currency == 'USDC') {
            tokenaddress = addresses[lender]['Tokens']['USDC'];
            ctokenaddress = addresses[lender]['lendingTokens']['USDC'];
            pricefeed = addresses[lender]['PriceOracleProxy']['USDC'];
        }
        else if (currency == 'USDT') {
            tokenaddress = addresses[lender]['Tokens']['USDT'];
            ctokenaddress = addresses[lender]['lendingTokens']['USDT'];
            pricefeed = addresses[lender]['PriceOracleProxy']['USDT'];
        }
        else if (currency == 'HELP') {
            tokenaddress = (await deployments.getOrNull("iHelp")).address;
            ctokenaddress = null;
            pricefeed = null;
        }

    }

    return {
        lender,
        currency,
        "token": tokenaddress,
        "lendingtoken": ctokenaddress,
        "pricefeed": pricefeed
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

