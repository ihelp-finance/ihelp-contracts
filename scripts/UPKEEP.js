const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
const externalContracts = require('../../react-app/src/contracts/external_contracts');

//const { assert, use, expect } = require("chai");

let userAccount, userSigner;
let signer;
let ihelp;

const fromBigNumber = (number) => {
    return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)))
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
        deployer,
        stakingPool,
        developmentPool,
        holdingPool,
    } = await hardhat.getNamedAccounts();

    signer = await hardhat.ethers.provider.getSigner(deployer);

    // const charity1walletSigner = await hardhat.ethers.provider.getSigner(charity1wallet);
    // const charity2walletSigner = await hardhat.ethers.provider.getSigner(charity2wallet);
    // const charity3walletSigner = await hardhat.ethers.provider.getSigner(charity3wallet);
    const developmentPoolSigner = await hardhat.ethers.provider.getSigner(developmentPool);
    const stakingPoolSigner = await hardhat.ethers.provider.getSigner(stakingPool);
    const holdingPoolSigner = await hardhat.ethers.provider.getSigner(holdingPool);

    console.log(`signer: ${signer._address}`);
    console.log(`holder: ${holdingPool}`);

    // get the signer eth balance
    const startbalance = await hardhat.ethers.provider.getBalance(signer._address);
    console.log(`start signer balance: ${fromBigNumber(startbalance)}`);
    
    const startbalanceholding = await hardhat.ethers.provider.getBalance(holdingPool);
    console.log(`start holding balance: ${fromBigNumber(startbalanceholding)}`);

    // const currentBlock= await hardhat.ethers.provider.getBlockNumber()

    console.log('\nSTARTING UPKEEP...\n');
    
    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
    ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);
    
    const mockDai = false;
    
    let dai,cdai,usdc,cusdc;
    const getTokenAddresses = async(currency, lender) => {

        let ctokenaddress = null;
        let pricefeed = null;
        let tokenaddress = null;

        let addresses = fs.readFileSync(`../networks/${chainName(chainId)}-lending.json`);
        addresses = JSON.parse(addresses);

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

        return {
            "token": tokenaddress,
            "lendingtoken": ctokenaddress,
            "pricefeed": pricefeed
        };

    }
    
    const mainnetInfura = new ethers.providers.StaticJsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
    const chainId = 43114;
    
    const daiAddresses = await getTokenAddresses('DAI', 'traderjoe');
    const daiAddress = daiAddresses['token'];
    dai = new ethers.Contract(daiAddress, externalContracts[chainId.toString()]['contracts']['DAI']['abi'], mainnetInfura);
    
    // drip the token interest
    console.log('dripping...');
    
    const dripTx = await ihelp.drip();
    console.log(dripTx['hash']);
    await dripTx.wait();

    // dump the tokens to the various pools
    console.log('dumping...');
    
    const dumpTx = await ihelp.dump();
    console.log(dumpTx['hash']);
    await dumpTx.wait();
    
    console.log('dev claiming...', developmentPool);
    const devTx1 = await ihelp.connect(developmentPoolSigner).getClaimableCharityInterest();
    console.log('dev claimable interest:',devTx1.toString());
    
    // var options = {
    //     nonce: 60
    // }
    
    if (parseFloat(devTx1.toString()) > 0) {
        
        let devTx1Approve = await dai.connect(holdingPoolSigner).approve(ihelpAddress,devTx1.toString());
        console.log('dev approval:',devTx1Approve);
        await devTx1Approve.wait();
        
        // chainlink oracle dynamic lookup of gas prices
    
        // var options = {
        //     gasPrice: 30000000000,
        //     gasLimit: 8000000,
        //     //nonce:57
        // }
        
        const devclaimTx = await ihelp.connect(holdingPoolSigner).claimInterest(developmentPool);
        console.log('dev claim:',devclaimTx);
        await devclaimTx.wait();
        
    }
    
    console.log('stake claiming...', stakingPool);
    const stakeTx1 = await ihelp.connect(stakingPoolSigner).getClaimableCharityInterest();
    console.log('stake claimable interest:',stakeTx1.toString());
    
    if (parseFloat(stakeTx1.toString()) > 0) {
            
        let stakeTx1Approve = await dai.connect(holdingPoolSigner).approve(ihelpAddress,stakeTx1.toString());
        console.log('stake approval:',stakeTx1Approve);
        await stakeTx1Approve.wait();
    
        const stakeclaimTx = await ihelp.connect(holdingPoolSigner).claimInterest(stakingPool);
        console.log('stake claim:',stakeclaimTx);
        await stakeclaimTx.wait();
    
    }
   
    const balanceend = await hardhat.ethers.provider.getBalance(signer._address);
    console.log(`end signer balance: ${fromBigNumber(balanceend)}`);
    
    const endbalanceholding = await hardhat.ethers.provider.getBalance(holdingPool);
    console.log(`end holding balance: ${fromBigNumber(endbalanceholding)}`);
    
    console.log(`signer cost:`,fromBigNumber(startbalance)-fromBigNumber(balanceend));
    console.log(`holder cost:`,fromBigNumber(startbalanceholding)-fromBigNumber(endbalanceholding));

    console.log('\nUPKEEP COMPLETE.\n');

}

upkeep();