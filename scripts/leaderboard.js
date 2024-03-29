const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
const axios = require('axios')

const { yellow, dim, fromBigNumber, getLendingConfigurations, cyan, runRpcTest } = require("./deployUtils");

const db = require('../../ihelp-app/config/db.js');

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../env/.env') })

let signer;
let analytics;

const upkeep = async() => {

    await runRpcTest();
    
    const nodeUrlWs = process.env.WEBSOCKET_RPC_URL;
    if (nodeUrlWs == '' || nodeUrlWs == undefined) {
        console.log('please define WEBSOCKET_RPC_URL env variable - exiting')
        process.exit(1)
    }
    
    const provider = new ethers.providers.WebSocketProvider(nodeUrlWs)
    
    let {
        deployer
    } = await hardhat.getNamedAccounts();

    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
    const analyticsContract = (await hardhat.deployments.get('analytics'));
    
    analytics = new ethers.Contract(analyticsContract.address, analyticsContract.abi, provider);
    
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
        
        const totalContributions = parseFloat(ethers.utils.formatUnits(c['totalContributions'],18));
        const totalDonations = parseFloat(ethers.utils.formatUnits(c['totalDonations'],18));
        const totalInterests = parseFloat(ethers.utils.formatUnits(c['totalInterestGenerated'],18));
        
        if (totalContributions > 0 || totalDonations > 0 || totalInterests > 0) {
        
            leaderboard['charities'].push({
                'address': c['charityAddress'],
                'name': c['charityName'],
                'contributions': totalContributions,
                'donations': totalDonations,
                'interests': totalInterests,
            })
            
            seq = seq.then(function() {
              //console.log(c)
                return analytics.getContributorsPerCharity(c['charityAddress'],0,1000).then(function(result) {
                    results.push(result);
                }).catch((e)=>{})
            });
        
        }

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