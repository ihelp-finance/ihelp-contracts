const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
const axios = require('axios')
const { getChainId, network } = require('hardhat');
const { green, yellow, dim, fromBigNumber, getLendingConfigurations, cyan } = require("./deployUtils");

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../env/.env') })

let signer;
let ihelp;

const updateGasLimit = async() => {

    const chainId = parseInt(await getChainId(), 10);

    let {
        deployer
    } = await hardhat.getNamedAccounts();

    signer = await hardhat.ethers.provider.getSigner(deployer);
    console.log('signer', signer._address);

    const ihelpContract = (await hardhat.deployments.get('iHelp'));
    ihelp = await hardhat.ethers.getContractAt("iHelpToken", ihelpContract.address, signer);
    
    const newGasLimit = '6500000';
    console.log('\nUpdating gas limit to',newGasLimit);
    await ihelp.setProcessingGasLimit(newGasLimit);

    console.log('update complete\n');
    process.exit(0)

}

updateGasLimit();
