const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
const externalContracts = require('../../react-app/src/contracts/external_contracts');

const IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json");
const IUniswapV2Pair = require("@uniswap/v2-core/build/IUniswapV2Pair.json");
const IUniswapV2Router02 = require("@uniswap/v2-periphery/build/IUniswapV2Router02.json");

//const { assert, use, expect } = require("chai");

let userAccount, userSigner;
let signer;
let ihelp, xhelp, swapper, charityPool1, charityPool2, charityPool3, dai, cdai;

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
        deployer,
        stakingPool,
    } = await hardhat.getNamedAccounts();

    signer = await hardhat.ethers.provider.getSigner(deployer);

    const stakingPoolSigner = await hardhat.ethers.provider.getSigner(stakingPool);

    console.log(`signer: ${deployer}`);
    console.log(`staking signer: ${stakingPool}`);

    // get the signer eth balance
    const startbalance = await hardhat.ethers.provider.getBalance(signer._address);
    console.log(`start signer balance: ${fromBigNumber(startbalance)}`);
    
    const startbalancestaking = await hardhat.ethers.provider.getBalance(stakingPool);
    console.log(`start staking balance: ${fromBigNumber(startbalancestaking)}`);

    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
    ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);

    const xhelpAddress = (await hardhat.deployments.get('xHelp')).address;
    xhelp = await hardhat.ethers.getContractAt('xHelpToken', xhelpAddress, signer);

    const swapperAddress = (await hardhat.deployments.get('swapper')).address;
    swapper = await hardhat.ethers.getContractAt('Swapper', swapperAddress, signer);

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

    const stakepool1Tx = await xhelp.totalAwarded();
    const stakepool1 = fromBigNumber(stakepool1Tx);
    console.log('\nStart Awarded:',stakepool1)

    // take the staking pool dai amount and distribute this across stakers
    const stakepoolTx = await dai.balanceOf(stakingPool);
    const stakepool = fromBigNumber(stakepoolTx);
    console.log('\nAmount of Dai to Reward:',stakepool);
    
    let stakepool2 = parseFloat(stakepool1);
    
    if (parseFloat(stakepool) > 0) {
    
        // approve the staking pool address to send from xhelp contract
        let rewardApprove = await dai.connect(stakingPoolSigner).approve(xhelpAddress,stakepoolTx.toString());
        await rewardApprove.wait();
        
        const calcRewardsTx = await xhelp.distributeRewards();
        await calcRewardsTx.wait();
        
        const stakepool2Tx = await xhelp.totalAwarded();
        stakepool2 = fromBigNumber(stakepool2Tx);
        console.log('\nEnd Awarded:',stakepool2)
        console.log('\nNewly Awarded:',(parseFloat(stakepool2) - parseFloat(stakepool1)).toFixed(6))

    }
    
    const balanceend = await hardhat.ethers.provider.getBalance(signer._address);
    console.log(`end signer balance: ${fromBigNumber(balanceend)}`);
    
    const endbalancestaking = await hardhat.ethers.provider.getBalance(stakingPool);
    console.log(`end staking balance: ${fromBigNumber(endbalancestaking)}`);
    
    const signerCost = fromBigNumber(startbalance)-fromBigNumber(balanceend);
    const stakerCost = fromBigNumber(startbalancestaking)-fromBigNumber(endbalancestaking);
    
    console.log(`signer cost:`,signerCost);
    console.log(`staker cost:`,stakerCost);
    
    console.log('\nREWARD DISTRIBUTION COMPLETE.\n');
    
    
    // const { Webhook } = require('discord-webhook-node');
    // const hook = new Webhook("");
     
    // const IMAGE_URL = 'https://avalanche.ihelp.finance/assets/ihelp_icon.png';
    // hook.setUsername('iHelp Job Monitor');
    // hook.setAvatar(IMAGE_URL);
     
    // hook.send("Reward Job Completed Successfully...\n   Signer Cost: "+signerCost.toFixed(4)+'\n   Staking Cost: '+stakerCost.toFixed(4)+'\n   Signer Balance: '+fromBigNumber(balanceend).toFixed(4)+'\n   Staker Balance: '+fromBigNumber(endbalancestaking).toFixed(4) +'\nNewly Awarded:' + (parseFloat(stakepool2) - parseFloat(stakepool1)).toFixed(6));


    /*
    let stakingPoolBalance = await dai.connect(stakingPoolSigner).balanceOf(stakingPool);
    console.log('stakingPoolDai', fromBigNumber(stakingPoolBalance));
    
    const currentBalanceHoldingBefore = await ihelp.balanceOf(xhelpAddress);
    console.log('help before:', fromBigNumber(currentBalanceHoldingBefore));
    
    if (fromBigNumber(stakingPoolBalance) > 0) {

        const minReward = Big(stakingPoolBalance).mul(0.01).toFixed(0);
        const stakeMe = stakingPoolBalance.toString();
        
        let swapApprove = await dai.connect(stakingPoolSigner).approve(swapperAddress, stakeMe);
        await swapApprove.wait();
        
        var options = {
            gasPrice: 21000000000,
            gasLimit: 10000000,
            //nonce:8
        }
            
        // swap dai for help and transfer to the xhelp contract to increase the exchange rate
        let swapme = await swapper.connect(stakingPoolSigner).swap(daiAddress, ihelpAddress, stakeMe, minReward, xhelpAddress, options);
        //console.log(swapme);
        await swapme.wait();
        
        const currentBalanceHoldingAfter = await ihelp.balanceOf(xhelpAddress);
        console.log('help after:', fromBigNumber(currentBalanceHoldingAfter));

    }
    */

    

}

upkeep();