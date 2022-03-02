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
        charity1wallet,
        charity2wallet,
        charity3wallet,
        userAccount,
    } = await hardhat.getNamedAccounts();

    console.log(`user:`, userAccount);

    userSigner = await hardhat.ethers.provider.getSigner(userAccount)

    signer = await hardhat.ethers.provider.getSigner(deployer);

    const charity1walletSigner = await hardhat.ethers.provider.getSigner(charity1wallet);
    const charity2walletSigner = await hardhat.ethers.provider.getSigner(charity2wallet);
    const charity3walletSigner = await hardhat.ethers.provider.getSigner(charity3wallet);
    const developmentPoolSigner = await hardhat.ethers.provider.getSigner(developmentPool);
    const stakingPoolSigner = await hardhat.ethers.provider.getSigner(stakingPool);
    const holdingPoolSigner = await hardhat.ethers.provider.getSigner(holdingPool);

    console.log(`staking signer: ${stakingPool}`);

    // get the signer eth balance
    const balance = await hardhat.ethers.provider.getBalance(stakingPool);
    console.log(`staking balance: ${fromBigNumber(balance)}`);

    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
    ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);

    const xhelpAddress = (await hardhat.deployments.get('xHelp')).address;
    xhelp = await hardhat.ethers.getContractAt('xHelpToken', xhelpAddress, signer);

    const swapperAddress = (await hardhat.deployments.get('swapper')).address;
    swapper = await hardhat.ethers.getContractAt('Swapper', swapperAddress, signer);

    const charity1Address = (await hardhat.deployments.get('charityPool1')).address;
    charityPool1 = await hardhat.ethers.getContractAt('CharityPool', charity1Address, signer);

    const charity2Address = (await hardhat.deployments.get('charityPool2')).address;
    charityPool2 = await hardhat.ethers.getContractAt('CharityPool', charity2Address, signer);

    const charity3Address = (await hardhat.deployments.get('charityPool3')).address;
    charityPool3 = await hardhat.ethers.getContractAt('CharityPool', charity3Address, signer);

    const mockDai = false;

    let dai;
    const getTokenAddresses = async(currency, lender) => {

        let ctokenaddress = null;
        let pricefeed = null;
        let tokenaddress = null;

        let addresses = fs.readFileSync(`../networks/${chainName(chainId)}-${lender}.json`);
        addresses = JSON.parse(addresses);

        if (currency == 'DAI') {
            tokenaddress = addresses['Tokens']['DAI']['address'];
            ctokenaddress = addresses['cTokens']['cDAI']['address'];
            pricefeed = addresses['PriceOracleProxy']['DAI'];
        }
        else if (currency == 'USDC') {
            tokenaddress = addresses['Tokens']['USDC']['address'];
            ctokenaddress = addresses['cTokens']['cUSDC']['address'];
            pricefeed = addresses['PriceOracleProxy']['USDC'];
        }
        else if (currency == 'WETH') {
            tokenaddress = '0xc778417E063141139Fce010982780140Aa0cD5Ab';
            ctokenaddress = null;
            pricefeed = addresses['PriceOracleProxy']['WETH'];
        }

        return {
            "token": tokenaddress,
            "lendingtoken": ctokenaddress,
            "pricefeed": pricefeed
        };

    }
    
    const mainnetInfura = new ethers.providers.StaticJsonRpcProvider("https://eth-rinkeby.alchemyapi.io/v2/UipRFhJQbBiZ5j7lbcWt46ex5CBjVBpW");
    const chainId = 4;
    
    const daiAddresses = await getTokenAddresses('DAI', 'compound');
    const daiAddress = daiAddresses['token'];
    dai = new ethers.Contract(daiAddress, externalContracts[chainId.toString()]['contracts']['DAI']['abi'], mainnetInfura);

    // console.log('');
    // green('Signer Address:', signer._address);
    // green('DAI Address:', daiAddress);
    // green('cDAI Address:', cDaiAddress);
    // green('USDC Address:', usdcAddress);
    // green('cUSDC Address:', cUsdcAddress);
    // green('WETH Address:', wethAddress);
    // green('cETH Address:', cEthAddress);
    // green('iHelp Address:', ihelpAddress);
    // green('xHelp Address:', xhelpAddress);
    // green('Swapper Address:', swapperAddress);
    // green('CharityPool 1 Address:', charity1Address);
    // green('CharityPool 2 Address:', charity2Address);
    // green('CharityPool 3 Address:', charity3Address);
    // // green('CharityPool 4 Address:', charity4Address);
    // green('Development Pool Address:', developmentPool);
    // green('Staking Pool Address:', stakingPool);
    // green('Holding Pool Address:', holdingPool);
    // green('');

    //console.log('\nSTARTING REWARD DISTRIBUTION...\n');

    // stakingPool dai accumulates from share of generated interest to the staking pool wallet

    // At the end of the distribution period the accumulated Dai in the staking pool is swapped for HELP tokens (essentially a buyback) on uniswap and/or sushiswap, increasing the xHELP to HELP ratio/exchange rate

    // These buyback events will accumulate this ratio over time 

    // Users can then trade their xHELP tokens back for HELP tokens

    // test swap of eth to dai

    // REWARD DISTRIBUTION

    // check the balance of dai in the staking pool

    // with the staking pool balance, on reward distribution swap out dai with help tokens

    // send the help tokens to the xhelp contract to increase the exchange rate

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

    console.log('\nREWARD DISTRIBUTION COMPLETE.\n');

}

upkeep();