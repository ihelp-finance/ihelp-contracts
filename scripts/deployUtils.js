
const fs = require('fs');
const { writeFileSync } = require('fs');
const path = require('path');
const ethersLib = require('ethers');
const chalk = require('chalk');
const Big = require('big.js');
const Web3 = require('web3');
const { readFileSync } = require("fs");
const web3 = new Web3('http://127.0.0.1:7545');
const { deployments, ethers, getNamedAccounts } = require("hardhat");
const ether = require('@openzeppelin/test-helpers/src/ether');



module.exports.deployCharityPoolsToNetwork = async (configurations, network, factoryContractName = "CharityBeaconFactory") => {
    const FILE_DIR = 'build'
    if (!fs.existsSync(FILE_DIR)) {
        fs.mkdirSync(FILE_DIR);
    }

    const FILE_PATH = path.join(FILE_DIR, `${network}_charities.json`);

    let deployedCharities = [];
    let result = [];

    if (fs.existsSync(FILE_PATH)) {
        const fileData = readFileSync(FILE_PATH, { encoding: 'utf-8' });
        deployedCharities = JSON.parse(fileData);
    }
    
    const existing = [];
    for (const [index, configuration] of configurations.entries()) {
        const { charityName } = configuration;
        
        // can use this to regenerate the charities.json file if accidentally deleted
        // const deplo = await deployments.get(charityName);
        // deployedCharities.push({
        //     charityName: charityName,
        //     address: deplo.address
        // })
        
        const alreadyExists = deployedCharities.find(item => item.charityName === charityName);
        if (alreadyExists) {
            this.yellow(`   Charity ${charityName} was already deployed, skipping...`);
            result.push({ ...JSON.parse(JSON.stringify(alreadyExists)), exists: true })
            existing.push(index)
        }
    }

    // writeFileSync(FILE_PATH, JSON.stringify(deployedCharities), "UTF-8", { 'flags': 'a+' });
    
    const remaining = configurations.filter((_, index) => !existing.includes(index));
    
    if (remaining.length > 0) {
    
        const factoryDeployment = await deployments.get(factoryContractName);
        const factory = await ethers.getContractAt(factoryContractName, factoryDeployment.address);
    
        const tx = await factory.createCharityPool(remaining);
    
        const { events } = await tx.wait();
        const { args } = events.find(item => item.event === 'Created');
        const { newCharities } = args;
    
        for (const charity of newCharities) {
            result.push({
                charityName: charity.name,
                address: charity.addr,
                exists: false
            });
            deployedCharities.push({
                charityName: charity.name,
                address: charity.addr,
                exists: false
            })
            console.log('   deployed:', charity.name, '   to address  ', charity.addr, ' at network :', network);
        }
        
        writeFileSync(FILE_PATH, JSON.stringify(deployedCharities), "UTF-8", { 'flags': 'a+' });
        
    }

    return result;
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
    const hardhatContracts = require(`../build/hardhat_contracts`);
    try {
        return hardhatContracts[chainId.toString()][0]['contracts']['WETH']['address'];
    } catch (e) {
        this.yellow('   WARNING - no NativeWrapper found... cannot wrap currency')
        return '0x0000000000000000000000000000000000000000'
    }
}


module.exports.updateCharityPools = async () => {
    const { deployer } = await getNamedAccounts();
    const result = await deployments.deploy('CharityPool_Implementation', {
        contract: 'CharityPool',
        from: deployer,
        args: [],
        log: true,
    });
    console.log('');
    address = result.address
    if (!result.newlyDeployed) {
        this.yellow(`${chalk.gray(`Reusing deployment`)} (${address})`);
    }

    const beaconFactoryDeployment = await deployments.get("CharityBeaconFactory");
    const signer = await ethers.getSigner(deployer);
    this.yellow(`${chalk.gray(`Using beacon factory at`)} (${beaconFactoryDeployment.address})`);

    const beaconFactory = await ethers.getContractAt("CharityBeaconFactory", beaconFactoryDeployment.address, signer);
    const owner = await beaconFactory.owner();
    if (owner === deployer) {
        this.yellow(`${chalk.gray(`Updating beacon to address`)} (${beaconFactoryDeployment.address})`);
        await beaconFactory.update(address);
    } else {
        const { data } = await beaconFactory.populateTransaction.update(address);
        console.log(chalk.gray(`\nAccount ${chalk.yellow(deployer)} does not have permission to execute the update. \nBroadcast the following tx from ${chalk.yellow(owner)} to execute the update :
       
        ${chalk.yellow(`${data}`)}
    `));
    }
}
