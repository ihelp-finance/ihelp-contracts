const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
// const externalContracts = require('../../react-app/src/contracts/external_contracts');

const db = require('../../ihelp-app/config/db.js');

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

    console.log(`signer: ${deployer}`);

    // get the signer eth balance
    const startbalance = await hardhat.ethers.provider.getBalance(signer._address);
    console.log(`start signer balance: ${fromBigNumber(startbalance)}`);
    
    const xhelpAddress = (await hardhat.deployments.get('xHelp')).address;
    xhelp = await hardhat.ethers.getContractAt('xHelpToken', xhelpAddress, signer);

    let dai,cdai,usdc,cusdc;

    const mainnetInfura = new ethers.providers.StaticJsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
    const chainId = 43114;
    
    const stakepool1Tx = await xhelp.totalAwarded();
    const stakepool1 = fromBigNumber(stakepool1Tx);
    console.log('\nStart Awarded:',stakepool1)

    let stakepool2 = parseFloat(stakepool1);
    
    // if (parseFloat(stakepool) > 0) {
    
    const calcRewardsTx = await xhelp.distributeRewards();
    await calcRewardsTx.wait();
    
    const stakepool2Tx = await xhelp.totalAwarded();
    stakepool2 = fromBigNumber(stakepool2Tx);
    console.log('\nEnd Awarded:',stakepool2)
    
    const newlyAwarded = parseFloat(stakepool2) - parseFloat(stakepool1)
    console.log('\nNewly Awarded:',newlyAwarded.toFixed(6))
    
    const data = {
        reward:newlyAwarded,
        total_reward:stakepool2 
    }
    
    if (newlyAwarded > 0) {
        await db.StakingStat.create(data)
    }

    // }
    
    const balanceend = await hardhat.ethers.provider.getBalance(signer._address);
    console.log(`\nend signer balance: ${fromBigNumber(balanceend)}`);

    const signerCost = fromBigNumber(startbalance)-fromBigNumber(balanceend);

    console.log(`signer cost:`,signerCost);

    console.log('\nREWARD DISTRIBUTION COMPLETE.\n');
    
    process.exit(0)
    
    
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