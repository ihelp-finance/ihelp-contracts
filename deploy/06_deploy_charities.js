const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const fs = require('fs');
const chalk = require('chalk');
const ethersLib = require('ethers');
const axios = require('axios');
const csv = require('csvtojson');
const { abi: CharityPoolAbi } = require('../artifacts/contracts/ihelp/charitypools/CharityPool.sol/CharityPool.json');

const { assert, use, expect } = require("chai");
const { deployCharityPoolsToNetwork, dim, yellow, red, chainName, fromBigNumber, cyan, green, getNativeWrapper, getLendingConfigurations } = require("../scripts/deployUtils");
const { network } = require("hardhat");

let userAccount, userSigner;
let signer;
let xhelp, ihelp, dai, cdai, swapper;

module.exports = async ({ getNamedAccounts, deployments, getChainId, ethers, upgrades }) => {

  let {
    deployer,
    userAccount
  } = await getNamedAccounts();

  const signer = await ethers.provider.getSigner(deployer);

  yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow("Charity Contracts - Deploy Script");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  const chainId = parseInt(await getChainId(), 10);

  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;

  // set this value to false to actually deploy a contract for each charity pool
  const deployTestCharities = process.env.TEST_CHARITIES || 'true';
  const deployMockTokens = process.env.REACT_APP_TEST_TOKENS || 'true';
  
  const charitiesToDeloy = 'all';

  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  userSigner = await ethers.provider.getSigner(userAccount);

  console.log(`signer: ${signer._address}`);

  // get the signer eth balance
  const balance = await ethers.provider.getBalance(signer._address);
  console.log(`signer balance: ${fromBigNumber(balance)}`);

  const ihelpAddress = (await deployments.get('iHelp')).address;
  ihelp = await ethers.getContractAt('iHelpToken', ihelpAddress, signer);

  const xhelpAddress = (await deployments.get('xHelp')).address;
  xhelp = await ethers.getContractAt('xHelpToken', xhelpAddress, signer);

  const swapperAddress = (await deployments.get('swapper')).address;
  const priceFeedProviderAddresss = (await deployments.get('priceFeedProvider')).address;

  //swapper = await ethers.getContractAt('swapper', swapperAddress, signer);

  console.log('');
  green('Signer Address:', signer._address);
  green('iHelp Address:', ihelpAddress);
  green('xHelp Address:', xhelpAddress);
  green('Swapper Address:', swapperAddress);
  green('PriceFeedProvider Address:', priceFeedProviderAddresss);

  console.log('');

  const holdingToken = 'DAI';
  let holdingtokenAddress = null;
  const configurations = await getLendingConfigurations(chainId);
  for (const lender of Object.keys(configurations)) {
    for (const coin of Object.keys(configurations[lender])) {
      if (coin.replace('.e','').replace('c','').replace('j','').replace('a','') == holdingToken) {
        holdingtokenAddress = configurations[lender][coin]['underlyingToken']
        break
      }
    }
  }
  
  // deploy charity
  const deployedCharities = [];
  const allCharities = [];

  const deployCharityPools = async (configurations) => {
    const pools = [];
    const nativeWrapper = await getNativeWrapper(chainId);
    
    for (const config of configurations) {
      const { charityName, charityWalletAddress } = config;
      pools.push({
        charityName,
        operatorAddress: signer._address,
        charityWalletAddress: charityWalletAddress,
        holdingTokenAddress: holdingtokenAddress,
        ihelpAddress: ihelpAddress,
        swapperAddress: swapperAddress,
        priceFeedProvider: priceFeedProviderAddresss,
        wrappedNativeAddress: nativeWrapper
      })
    }

    const charityResult = await deployCharityPoolsToNetwork(pools, network.name);
    
    for (const result of charityResult) {
      const { contractName } = configurations.find(config => config.charityName === result.charityName)

      const isInAllCharities = allCharities.indexOf(item => item.contractName === contractName);
      if (isInAllCharities == -1) {
        allCharities.push([contractName, result])
      }

      if (result['exists'] === true) {
        continue;
      }
      deployments.save(contractName, { abi: CharityPoolAbi, address: result.address });
      deployedCharities.push([contractName, result]);
      //yellow('   deployed:', contractName, result.address);
    }

  };
  
  const registerCharityPools = async () => {
  
      const forceRegisterMissingCharities = true;

      function delay(t, val) {
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve(val);
          }, t);
        });
      }
      
      const charitiesToRegister = [];

      if (forceRegisterMissingCharities == true) {

        const currentCharities = await ihelp.getCharities()
        
        for (let i = 0; i < allCharities.length; i++) {

          if (currentCharities.indexOf(allCharities[i][1].address) == -1) {
            
            //cyan(`   ${i + 1}/${allCharities.length} - registering: ${allCharities[i][0]}`);
            // add a delay if not on a local chain to throttle requests
            // if (network.name != 'localhost') {
            //   await delay(2000);
            // }
            // await ihelp.registerCharityPool(allCharities[i][1].address);
            
            charitiesToRegister.push(allCharities[i][1].address);
            
          }

        }

      }
      else {

        for (let i = 0; i < deployedCharities.length; i++) {

          //cyan(`   ${i + 1}/${deployedCharities.length} - registering: ${deployedCharities[i][0]}`);
          // add a delay if not on a local chain to throttle requests
          // if (network.name != 'localhost') {
          //   await delay(2000);
          // }
          // await ihelp.registerCharityPool(deployedCharities[i][1].address);
          
          charitiesToRegister.push(deployedCharities[i][1].address);

        }

      }
      
      if (charitiesToRegister.length > 0) {
        console.log('Registering',charitiesToRegister.length,'charities with the ihelp protocol...');
        await ihelp.bulkRegisterCharityPools(charitiesToRegister);
      }

      const number = await ihelp.numberOfCharities();
      cyan(`\nNumber of Registered Charities: ${Big(number).toFixed(0)}`);
      
  }
  

  if (isTestEnvironment == true && deployTestCharities == 'true') {

    await deployCharityPools([
      { contractName: 'charityPool1', charityName: 'Charity Pool 1', charityWalletAddress: ethersLib.constants.AddressZero },
      { contractName: 'charityPool2', charityName: 'Charity Pool 2', charityWalletAddress: ethersLib.constants.AddressZero },
      { contractName: 'charityPool3', charityName: 'Charity Pool 3', charityWalletAddress: ethersLib.constants.AddressZero }
    ]);

    console.log('\nDeployed Charities:', deployedCharities.length);
    console.log('');
    // let numberOfCharities = await ihelp.numberOfCharities();
    // if (numberOfCharities.toString() == '0') {
    //   console.log('registering deployed charities with the ihelp protocol...');
    //   for (let i = 0; i < deployedCharities.length; i++) {
    //     await ihelp.registerCharityPool(deployedCharities[i][1].address);
    //   }
    // }
    
    await registerCharityPools();

  }
  else {

    var long_id = "1KQ7kzA2T8nDED8vo9XjnSEQyLDkxajhO6fkw1H72KgM";
    var g_id = "727836194";
    var url = "https://docs.google.com/spreadsheets/d/" + long_id + "/export?gid=" + g_id + "&format=csv&id=" + long_id;

    const response = await axios.get(url);
    const result = response.data;
    const charityJson = await csv().fromString(result);

    // RUN ALL THE CHARITIES
    const charityJsonRun = charityJson;
    
    const charitiesToDeploy = [];
    
    const deployCharity = async (ci) => {

      const c = charityJsonRun[ci];

      // console.log(c['Organization Name']);

      // assume all the charity pools start with no charity wallet defined (can update this on a case by case basis later)
      if (c['Status'] == 'LIVE') {
        charitiesToDeploy.push({ contractName: c['Organization Name'], charityName:c['Organization Name'], charityWalletAddress: ethersLib.constants.AddressZero });
      }
      
      if (ci < charityJsonRun.length - 1 && (ci < parseInt(charitiesToDeloy) - 1 || charitiesToDeloy == 'all')) {
        await deployCharity(ci + 1);
      }
      else {
      
        console.log('Deploying',charitiesToDeploy.length,'charityPool contracts...')
        await deployCharityPools(charitiesToDeploy);

        const contractAddresses = [];
        deployedCharities.map((d) => { contractAddresses.push({ name: d[0], address: d[1].address }); });

        console.log('\nDeployed Charities:', deployedCharities.length);
        console.log('');

        await registerCharityPools();

        // write the key addresses to a csv file
        return true
      }
    };

    if (charityJsonRun.length > 0) {
      await deployCharity(0);
    }
    
  }

};

module.exports.tags = ["charityDeployment"];
module.exports.dependencies = ['FactoryDeployments',];
