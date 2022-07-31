const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
const axios = require('axios')

const db = require('../../ihelp-app/config/db.js');

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../env/.env') })

let signer;
let analytics;

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
        deployer
    } = await hardhat.getNamedAccounts();
    
    // const currentBlock = await hardhat.ethers.provider.getBlock('latest')
    // console.log(currentBlock['number'])
    // process.exit(0)

    signer = await hardhat.ethers.provider.getSigner(deployer);

    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;

    const analyticsAddress = (await hardhat.deployments.get('analytics')).address;
    analytics = await hardhat.ethers.getContractAt('Analytics', analyticsAddress, signer);
    
    // const nicknames = await axios.get('https://dev.ihelp.finance/api/v1/data/allnicknames')
    // const nicknameHash = {}
    // nicknames.data.map((n)=>{
    //     nicknameHash[n['address']] = n['nickname']
    // })
    // console.log(nicknameHash)
    const nicknames = await db.AddressNickname.findAll({attributes:['address','nickname']})
    const nicknameHash = {}
    nicknames.map((n)=>{
        nicknameHash[n['address']] = n['nickname']
    })
    console.log(nicknameHash)
    
    // this leaderboard collection will get both users
    
    const charityPoolsWithContributions = await analytics.getCharityPoolsWithContributions(ihelpAddress,0,1000);
 
    const leaderboard = {
        helpers: [],
        charities: []
    }

    var results = [];
    var seq = Promise.resolve();
    charityPoolsWithContributions.map(async (c)=>{
        
        leaderboard['charities'].push({
            'address': c['charityAddress'],
            'name': c['charityName'],
            'contributions': parseFloat(ethers.utils.formatUnits(c['totalContributions'],18)),
            'donations': parseFloat(ethers.utils.formatUnits(c['totalDonations'],18)),
            'interests': parseFloat(ethers.utils.formatUnits(c['totalInterestGenerated'],18)),
        })
        
        seq = seq.then(function() {
          //console.log(c)
            return analytics.getContributorsPerCharity(c['charityAddress'],0,1000).then(function(result) {
                results.push(result);
            }).catch((e)=>{})
        });
        
    })
    
    await seq.then(async function() {
        
        const donationArray = {}
        
        if (results.length > 0) {
            
          results.map((d)=>{
              d.map((c)=>{
                
                    if (Object.keys(donationArray).indexOf(c['contributorAddress']) > -1 ) {
                        donationArray[c['contributorAddress']]['contributions'] += parseFloat(ethers.utils.formatUnits(c['totalContributions'],18));
                        donationArray[c['contributorAddress']]['donations'] += parseFloat(ethers.utils.formatUnits(c['totalDonations'],18));
                        donationArray[c['contributorAddress']]['interests'] += parseFloat(ethers.utils.formatUnits(c['totalInterestGenerated'],18));
                    }
                    else {
                        donationArray[c['contributorAddress']] = {
                            contributions:0,
                            donations:0,
                            interests:0,
                            address: c['contributorAddress']
                        }
                        donationArray[c['contributorAddress']]['contributions'] += parseFloat(ethers.utils.formatUnits(c['totalContributions'],18));
                        donationArray[c['contributorAddress']]['donations'] += parseFloat(ethers.utils.formatUnits(c['totalDonations'],18));
                        donationArray[c['contributorAddress']]['interests'] += parseFloat(ethers.utils.formatUnits(c['totalInterestGenerated'],18));
                    }
                  
              })
          })
          
          Object.keys(donationArray).map((c)=>{
              donationArray[c]['name'] = nicknameHash[donationArray[c]['address']]
              leaderboard['helpers'].push(donationArray[c])
          })
          
          console.log(leaderboard['helpers'])

        }
        
    });
    
    //console.log(leaderboard)

    await Promise.all(
    leaderboard['helpers'].map(async (h) => {
          
          const user = await db.UserStats.findOne({
              where: {
                address: h['address']
              }
            })
            
          if (user == null) {
            
            await db.UserStats.create(h)
            
          } else {
            
            user['name'] = h['name']
            user['address'] = h['address']
            user['contributions'] = h['contributions']
            user['interests'] = h['interests']
            user['donations'] = h['donations']
            
            await user.save();
            
          }
          
        })
    )
    
    await Promise.all(
    leaderboard['charities'].map(async (h) => {
          
          const charity = await db.CharityStats.findOne({
              where: {
                address: h['address']
              }
            })
            
          if (charity == null) {
            
            await db.CharityStats.create(h)
            
          } else {
            
            charity['name'] = h['name']
            charity['address'] = h['address']
            charity['contributions'] = h['contributions']
            charity['interests'] = h['interests']
            charity['donations'] = h['donations']
            
            await charity.save();
            
          }
          
        })
    )
    
    console.log('\nLEADERBOARD COLLECTION COMPLETE.\n');
    
    process.exit(0)

    // const { Webhook } = require('discord-webhook-node');
    // const hook = new Webhook("");
     
    // const IMAGE_URL = 'https://avalanche.ihelp.finance/assets/ihelp_icon.png';
    // hook.setUsername('iHelp Job Monitor');
    // hook.setAvatar(IMAGE_URL);
     
    // hook.send("Reward Job Completed Successfully...\n   Signer Cost: "+signerCost.toFixed(4)+'\n   Staking Cost: '+stakerCost.toFixed(4)+'\n   Signer Balance: '+fromBigNumber(balanceend).toFixed(4)+'\n   Staker Balance: '+fromBigNumber(endbalancestaking).toFixed(4) +'\nNewly Awarded:' + (parseFloat(stakepool2) - parseFloat(stakepool1)).toFixed(6));

}

upkeep();