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

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: 'contractAddresses.csv',
  header: [
    { id: 'name', title: 'Contract' },
    { id: 'address', title: 'Address' },
  ],
  append: true
});

// const externalContracts = require('../../react-app/src/contracts/external_contracts');

const { assert, use, expect } = require("chai");
const { deployCharityPoolToNetwork, dim, yellow, chainName, fromBigNumber, green, getNativeWrapper, getTokenAddresses } = require("../scripts/deployUtils");
const { network } = require("hardhat");

let userAccount, userSigner;
let signer;
let xhelp, ihelp, dai, cdai, swapper;

module.exports = async ({ getNamedAccounts, deployments, getChainId, ethers, upgrades }) => {

  let {
    deployer,
    stakingPool,
    developmentPool,
    holdingPool,
    userAccount,
    charity1wallet,
    charity2wallet,
    charity3wallet
  } = await getNamedAccounts();

  const deployMockTokens = true;
  const skipIfAlreadyDeployed = true; //isTestEnvironment == true ? false : true;

  const signer = await ethers.provider.getSigner(deployer);

  yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow("Charity Contracts - Deploy Script");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  const chainId = parseInt(await getChainId(), 10);

  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;

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


  // deploy charity - make this a function
  const ihelpAddresses = await getTokenAddresses('DAI', 'compound', chainId);
  const holdingtokenAddress = ihelpAddresses['underlyingToken'];

  console.log("Holding Token", "DAI", chainId, holdingtokenAddress);

  const deployedCharities = [];

  const deployCharityPool = async (contractName, charityName, charityWalletAddress) => {

    const nativeWrapper = getNativeWrapper(chainId);
    const charityResult = await deployCharityPoolToNetwork({
      charityName: charityName,
      operatorAddress: signer._address,
      charityWalletAddress: charityWalletAddress,
      holdingTokenAddress: holdingtokenAddress,
      ihelpAddress: ihelpAddress,
      swapperAddress: swapperAddress,
      priceFeedProvider: priceFeedProviderAddresss,
      wrappedNativeAddress: nativeWrapper
    }, network.name);

    if(!charityResult) {
      return;
    }
    deployments.save(contractName, { abi: CharityPoolAbi, address: charityResult.address });
    deployedCharities.push([contractName, charityResult]);

    yellow('   deployed:', contractName, charityResult.address);
  };

  if (isTestEnvironment == true) {
    await deployCharityPool('charityPool1', 'Charity Pool 1', ethersLib.constants.AddressZero, 'DAI', 'compound');
    await deployCharityPool('charityPool2', 'Charity Pool 2', ethersLib.constants.AddressZero, 'USDC', 'compound');
    await deployCharityPool('charityPool3', 'Charity Pool 3', ethersLib.constants.AddressZero, 'DAI', 'compound');

    console.log('newly deployedCharities:', deployedCharities.map((d) => { return [d[0], d[1].address]; }));
    let numberOfCharities = await ihelp.numberOfCharities();
    if (numberOfCharities.toString() == '0') {
      for (let i = 0; i < deployedCharities.length; i++) {
        await ihelp.registerCharityPool(deployedCharities[i][1].address);
      }
    }

  }
  else {

    const mainnetInfura = new ethers.providers.StaticJsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");

    var long_id = "1lwHTt1C8tkm_LEHFv2kcqaTOgNFJ6U0p32M_j98zts0";
    var g_id = "313945428";
    var url = "https://docs.google.com/spreadsheets/d/" + long_id + "/export?gid=" + g_id + "&format=csv&id=" + long_id;

    const response = await axios.get(url);
    const result = response.data;
    const charityJson = await csv().fromString(result);

    // RUN ALL THE CHARITIES
    const charityJsonRun = charityJson;

    const deployCharity = async (ci) => {
      const c = charityJsonRun[ci];

      console.log(c['Organization Name']);

      await deployCharityPool(`${c['Organization Name']}-DAI-traderjoe`, c['Organization Name'], ethersLib.constants.AddressZero, 'DAI', 'traderjoe');
      await deployCharityPool(`${c['Organization Name']}-USDC-traderjoe`, c['Organization Name'], ethersLib.constants.AddressZero, 'USDC', 'traderjoe');
      //await deployCharityPool(`${c['Organization Name']}-USDT`, c['Organization Name'], holdingPool, 'USDT', 'aave');

      if (ci < charityJsonRun.length - 1) {
        await deployCharity(ci + 1);
      }
      else {

        const contractAddresses = [];
        deployedCharities.map((d) => { contractAddresses.push({ name: d[0], address: d[1].address }); });

        // console.log('\ndeployedCharities:');
        // console.log(contractAddresses);
        // console.log('');

        console.log('registering deployed charities with the ihelp protocol...');

        for (let i = 0; i < deployedCharities.length; i++) {

          if (deployedCharities[i][1].newlyDeployed) {
            console.log(i + 1, '/', deployedCharities.length);
            cyan(`   registering: ${deployedCharities[i][0]}`);
            await ihelp.registerCharityPool(deployedCharities[i][1].address);
          }

        }

        // console.log('deregistering old charities');
        // await ihelp.deregisterCharityPool('0xE2EDFcCf1653a0E6c9d27810739b136FB5406cAd');
        // await ihelp.deregisterCharityPool('0x3D474446981C4EE33817884E71d4BE2ebF8a1896');

        const number = await ihelp.numberOfCharities();
        console.log(Big(number).toFixed(0));

        // write the key addresses to a csv file
        return csvWriter.writeRecords(contractAddresses).then(() => { });

      }
    };

    if (charityJsonRun.length > 0) {
      await deployCharity(0);
    }

  }

};

module.exports.tags = ["charityDeployment"];
module.exports.dependencies = ['FactoryDeployments',];
