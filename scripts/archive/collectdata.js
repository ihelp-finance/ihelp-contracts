const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
const axios = require('axios')

const externalContracts = require('../../react-app/src/contracts/external_contracts');
const hardhatContracts = require('../../react-app/src/contracts/hardhat_contracts');

const db = require('../../../../ihelp-app/config/db.js');

const { assert, use, expect } = require("chai");

let userAccount, userSigner;
let signer;
let xhelp, ihelp, dai, cdai;

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

const fromBigNumber = (number) => {
    return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)))
}

const upkeep = async() => {

    const { deploy } = hardhat.deployments;

    let {
        deployer,
        stakingPool,
        developmentPool,
        holdingPool,
        userAccount,
    } = await hardhat.getNamedAccounts();

    // console.log(`user:`, userAccount);

    userSigner = await hardhat.ethers.provider.getSigner(userAccount)

    signer = await hardhat.ethers.provider.getSigner(deployer);

    const developmentPoolSigner = await hardhat.ethers.provider.getSigner(developmentPool);
    const stakingPoolSigner = await hardhat.ethers.provider.getSigner(stakingPool);
    const charityPoolSigner = await hardhat.ethers.provider.getSigner(holdingPool);

    console.log(`signer: ${signer._address}`);

    // get the signer eth balance
    // const balance = await hardhat.ethers.provider.getBalance(signer._address);
    // console.log(`signer balance: ${fromBigNumber(balance)}`);

    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
    ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);

    const xhelpAddress = (await hardhat.deployments.get('xHelp')).address;
    xhelp = await hardhat.ethers.getContractAt('xHelpToken', xhelpAddress, signer);

    const mainnetInfura = new ethers.providers.StaticJsonRpcProvider(process.env.REACT_APP_RPC_URL);
    const chainId = 43114;

    console.log('\nSTARTING DATA COLLECTION...\n');

    // get the leaderboard metrics (over time - e.g. every hour) - put into simple database

    // current total contributions by charity

    // total interest generated by charity

    // contributions by users

    var long_id = "1lwHTt1C8tkm_LEHFv2kcqaTOgNFJ6U0p32M_j98zts0"
    var g_id = "313945428"
    var url = "https://docs.google.com/spreadsheets/d/" + long_id + "/export?gid=" + g_id + "&format=csv&id=" + long_id

    const response = await axios.get(url)
    const result = response.data
    const charityJson = await csv().fromString(result)
    
    //   const p = async(ci) => {
    //     const c = charityJsonRun[ci];

    //     console.log(c['Organization Name'])

    //     if (ci < charityJsonRun.length-1) {
    //       await deployCharity(ci+1)
    //     } else {

    //       // for (let i = 0; i < deployedCharities.length; i++) {
    //       //   await ihelp.registerCharityPool(deployedCharities[i][1].address);
    //       // }

    //     }
    //   }

    //   if (charityJsonRun.length > 0) {
    //     await deployCharity(0)
    //   }

    const charitiesToLoop = [];
    for (let i = 0; i < charityJson.length; i++) {

        const d = charityJson[i];

        const charityaddressDAI = (await hardhat.deployments.get(`${d['Organization Name']}-DAI-traderjoe`)).address;
        const charityDAI = await hardhat.ethers.getContractAt('CharityPool', charityaddressDAI, signer);

        const charityaddressUSDC = (await hardhat.deployments.get(`${d['Organization Name']}-USDC-traderjoe`)).address;
        const charityUSDC = await hardhat.ethers.getContractAt('CharityPool', charityaddressUSDC, signer);

        charitiesToLoop.push(charityDAI)
        charitiesToLoop.push(charityUSDC)
    }
    
    const charityContributions = {};
    const charityContributionsUsd = {};
    const userContributions = {};
    const userContributionsUsd = {};

    const userContributionsByCharity = {};
    const userContributionsUsdByCharity = {};

    const today = new Date();

    let charityCount = 0;
    await charitiesToLoop.map(async(charity) => {

        let name = await charity.name();
 
        // get the price of the currency
        const tokenPrice = await charity.getUnderlyingTokenPrice();
        const charityCurrency = await charity.tokenname();

        // get contributors
        let contributors = await charity.getContributors();

        let decimals = null; //await charity.decimals();
        if (charityCurrency == 'DAI') {
            decimals = 18;
        }
        else if (charityCurrency == 'USDC') {
            decimals = 6;
        }

        console.log(name, contributors);

        // get contribution by user

        const getContribBalance = async(c) => {

            const contributor = contributors[c];

            // get the contributor balance
            let balance = await charity.balanceOf(contributor);
            balance = parseFloat(ethers.utils.formatUnits(Big(balance).toFixed(0), decimals));
            //console.log(name, contributor, (balance));

            // console.log(tokenPrice);

            const convertExchangeRateToWei = 100000000;
            const tokenPriceWei = tokenPrice / convertExchangeRateToWei;
            const totalInterestInUSD = balance * tokenPriceWei;

            //console.log(tokenPrice, totalInterestInUSD);

            if (contributor in userContributions) {
                userContributions[contributor] += balance;
                userContributionsUsd[contributor] += totalInterestInUSD;
            }
            else {
                userContributions[contributor] = balance;
                userContributionsUsd[contributor] = totalInterestInUSD;
            }

            if (Object.keys(userContributionsByCharity).indexOf(contributor) == -1) {
                userContributionsByCharity[contributor] = {};
                userContributionsUsdByCharity[contributor] = {};
            }

            userContributionsByCharity[contributor][charity.address] = balance;
            userContributionsUsdByCharity[contributor][charity.address] = totalInterestInUSD;

            const key = name + '---' + charity.address + '---' + charityCurrency;
            if (key in charityContributions) {
                charityContributions[key] += balance;
                charityContributionsUsd[key] += totalInterestInUSD;
            }
            else {
                charityContributions[key] = balance;
                charityContributionsUsd[key] = totalInterestInUSD;
            }

            if (c < contributors.length - 1) {
                getContribBalance(c + 1)
            }
            else {
                getTotalCharityInterest();
            }

        }

        const getTotalCharityInterest = async() => {

            // get total charity contribution
            let interest = await charity.totalInterestEarned();

            interest = ethers.utils.formatUnits(Big(interest).toFixed(0), decimals);

            //console.log(name,  interest, decimals)

            const data = {
                time: today.setMinutes(0, 0, 0),
                charityname: name,
                charityaddress: charity.address,
                total_interest: parseFloat(interest)
            }

            db.TotalInterestByCharity.findOne({
                where: {
                    charityaddress: charity.address,
                    time: today.setMinutes(0, 0, 0)
                }
            }).then((d) => {
                if (d == null) {
                    return db.TotalInterestByCharity.create(data);
                }
                else {
                    d.total_interest = data.total_interest;
                    return d.save();
                }
            }).then((d) => {

                charityCount += 1;
                if (charityCount == charitiesToLoop.length) {
                    saveUserData();
                }
            });
        }

        if (contributors.length > 0) {
            getContribBalance(0);
        }
        else {
            getTotalCharityInterest();
        }

    })

    const saveUserData = () => {

        // save the resulting values
        //console.log('userContributions',userContributions);

        const saveUser = (u) => {

            let users = Object.keys(userContributions);
            const user = users[u];

            //console.log('userContributionsByCharity',userContributionsByCharity[user])

            const data = {
                time: today.setMinutes(0, 0, 0),
                useraddress: user,
                total_contrib: userContributions[user],
                total_contrib_usd: userContributionsUsd[user],
                contrib_by_charity: JSON.stringify(userContributionsByCharity[user]),
                contrib_by_charity_usd: JSON.stringify(userContributionsUsdByCharity[user]),
            }

            db.ContribByUser.findOne({
                where: {
                    useraddress: user,
                    time: today.setMinutes(0, 0, 0)
                }
            }).then((d) => {
                if (d == null) {
                    return db.ContribByUser.create(data);
                }
                else {
                    d.total_contrib = data.total_contrib;
                    d.total_contrib_usd = data.total_contrib_usd;
                    d.contrib_by_charity = data.contrib_by_charity;
                    d.contrib_by_charity_usd = data.contrib_by_charity_usd;
                    return d.save();
                }
            }).then(() => {

                if (u < users.length - 1) {
                    saveUser(u + 1);
                }
                else {
                    saveCharityData();
                }

            })

        }


        let users = Object.keys(userContributions);
        if (users.length > 0) {
            saveUser(0);
        }
        else {
            saveCharityData();
        }

        //console.log(charityContributions);

    }

    const saveCharityData = () => {

        // save the resulting values

        //console.log(charityContributions);

        const saveCharity = (u) => {

            let chars = Object.keys(charityContributions);
            const char = chars[u];
            const charname = char.split('---')[0];
            const charaddress = char.split('---')[1];
            const charcurrency = char.split('---')[2];

            const data = {
                time: today.setMinutes(0, 0, 0),
                charityname: charname,
                charityaddress: charaddress,
                total_contrib: charityContributions[char],
                total_contrib_usd: charityContributionsUsd[char],
                currency: charcurrency
            }

            db.ContribByCharity.findOne({
                where: {
                    charityaddress: charaddress,
                    time: today.setMinutes(0, 0, 0)
                }
            }).then((d) => {
                if (d == null) {
                    return db.ContribByCharity.create(data);
                }
                else {
                    d.total_contrib = data.total_contrib;
                    d.total_contrib_usd = data.total_contrib_usd;
                    d.currency = data.currency;
                    d.charityname = charname;
                    return d.save();
                }
            }).then(() => {

                if (u < chars.length - 1) {
                    saveCharity(u + 1);
                }
                else {
                    syncStakingStats();
                }

            })

        }


        let chars = Object.keys(charityContributions);
        if (chars.length > 0) {
            saveCharity(0);
        }
        else {
            syncStakingStats();
        }

    }

    const syncStakingStats = async() => {

        const data = {
            time: today.setMinutes(0, 0, 0),
            ihelp_interest_generated: parseFloat(ethers.utils.formatUnits(Big(await ihelp.interestGenerated()).toFixed(0), 18)),
            ihelp_circulating: parseFloat(ethers.utils.formatUnits(Big(await ihelp.totalCirculating()).toFixed(0), 18)),
            ihelp_supply: parseFloat(ethers.utils.formatUnits(Big(await ihelp.totalSupply()).toFixed(0), 18)),
            ihelp_avail_supply: parseFloat(ethers.utils.formatUnits(Big(await ihelp.totalAvailableSupply()).toFixed(0), 18)),
            xhelp_exchange_rate: parseFloat(ethers.utils.formatUnits(Big(await xhelp.exchangeRateCurrent()).toFixed(0), 18)),
            xhelp_cash: parseFloat(ethers.utils.formatUnits(Big(await xhelp.getCash()).toFixed(0), 18)),
            xhelp_supply: parseFloat(ethers.utils.formatUnits(Big(await xhelp.totalSupply()).toFixed(0), 18)),
            xhelp_apy: 0,
        }

        // Rate = cToken.supplyRatePerBlock(); // Integer
        // Rate = 37893566
        // ETH Mantissa = 1 * 10 ^ 18 (ETH has 18 decimal places)
        // Blocks Per Day = 6570 (13.15 seconds per block)
        // Days Per Year = 365
        // APY = ((((Rate / ETH Mantissa * Blocks Per Day + 1) ^ Days Per Year)) - 1) * 100

        const apy = await (((data.xhelp_exchange_rate / 6570) ^ 365) - 1);
        data.xhelp_apy = apy;

        db.StakingStat.findOne({
            where: {
                time: today.setMinutes(0, 0, 0)
            }
        }).then((d) => {
            if (d == null) {
                return db.StakingStat.create(data);
            }
            else {
                d.ihelp_interest_generated = data.ihelp_interest_generated;
                d.ihelp_circulating = data.ihelp_circulating;
                d.ihelp_supply = data.ihelp_supply;
                d.ihelp_avail_supply = data.ihelp_avail_supply;
                d.xhelp_exchange_rate = data.xhelp_exchange_rate;
                d.xhelp_cash = data.xhelp_cash;
                d.xhelp_supply = data.xhelp_supply;
                d.xhelp_apy = data.xhelp_apy;
                return d.save();
            }
        }).then(() => {

            finishSync();

        })

    }

    const finishSync = () => {
        console.log('DATA COLLECTION COMPLETE.\n');
        process.exit(0)
    }

}

upkeep();