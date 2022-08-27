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

const updateFees = async() => {

    const chainId = parseInt(await getChainId(), 10);

    let {
        deployer
    } = await hardhat.getNamedAccounts();

    signer = await hardhat.ethers.provider.getSigner(deployer);
    console.log('signer', signer._address);

    const ihelpContract = (await hardhat.deployments.get('iHelp'));
    ihelp = await hardhat.ethers.getContractAt("iHelpToken", ihelpContract.address, signer);

    const currentLendingFees = await ihelp.getFees();
    cyan(`\ncurrent lending fees on protocol:`, currentLendingFees);

    const currentLendingFeesClean = currentLendingFees.map((c) => {
        return parseInt(c)
    })

    // format: _dev, _stake, _charity * 1000
    const newLendingFees = [100, 100, 800];

    if (JSON.stringify(currentLendingFeesClean) != JSON.stringify(newLendingFees)) {

        yellow(`\nupdating lending fees on protocol:`, newLendingFees);
        const tx = await ihelp.setDirectDonationFees(...newLendingFees);
        const events = tx.wait();

        const newLendingFeesSet = await ihelp.getFees();
        cyan(`\nnew lending fees on protocol:`, newLendingFeesSet);

    }
    else {
        green('lending fees already set properly...')
    }

    const currentDirectLendingFees = await ihelp.getDirectDonationFees();
    cyan(`\ncurrent direct donation fees on protocol:`, currentDirectLendingFees);

    const currentDirectLendingFeesClean = currentDirectLendingFees.map((c) => {
        return parseInt(c)
    })

    // format: _dev, _stake, _charity * 1000
    const newDirectionDonationFees = [25, 25, 950];

    if (JSON.stringify(currentDirectLendingFeesClean) != JSON.stringify(newDirectionDonationFees)) {

        yellow(`updating direct donation fees on protocol:`, newDirectionDonationFees);
        const tx = await ihelp.setDirectDonationFees(...newDirectionDonationFees);
        const events = tx.wait();

        const newDirectLendingFeesSet = await ihelp.getDirectDonationFees();
        cyan(`new direct donation fees on protocol:`, newDirectLendingFeesSet);

    }
    else {
        green('direct donation fees already set properly...')
    }
    
    console.log();
    process.exit(0)

}

updateFees();
