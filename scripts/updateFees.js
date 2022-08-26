const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
const axios = require('axios')
const { getChainId, network } = require('hardhat');
const { yellow, dim, fromBigNumber, getLendingConfigurations, cyan } = require("./deployUtils");

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

    const pfpContract = (await hardhat.deployments.get('priceFeedProvider'));
    priceFeed = await hardhat.ethers.getContractAt("PriceFeedProvider", pfpContract.address, signer);

    const configurations = await getLendingConfigurations(chainId);
    const currencies = [];

    for (const lender of Object.keys(configurations)) {
        for (const token of Object.keys(configurations[lender])) {
            currencies.push({
                "currency": token.replace('c', '').replace('a', '').replace('j', ''),
                "provider": lender,
                "underlyingToken": configurations[lender][token].underlyingToken,
                "lendingAddress": configurations[lender][token].lendingAddress,
                "priceFeed": configurations[lender][token].priceFeed,
                "connector": configurations[lender][token].connector
            })
        }
    }

    cyan(`\nupdating ${currencies.length} supported currencies to the protocol...`);

    for (const currency of currencies) {
        
        yellow('   updating',currency['currency'],'on',currency['provider']+'...');
        
        console.log(currency);
        
        const tx = await priceFeed.updateDonationCurrency(currency);
        
        const { events } = await tx.wait();
        
    }

    process.exit(0)

}

updateFees();
