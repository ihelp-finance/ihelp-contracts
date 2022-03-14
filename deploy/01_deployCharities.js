const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const fs = require('fs');
const chalk = require('chalk')
const ethersLib = require('ethers')
const ethers = require('ethers')
const axios = require('axios')
const csv = require('csvtojson')

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: 'contractAddresses.csv',
  header: [
    { id: 'name', title: 'Contract' },
    { id: 'address', title: 'Address' },
  ],
  append: true
});

const externalContracts = require('../../react-app/src/contracts/external_contracts');

const { assert, use, expect } = require("chai");

let userAccount, userSigner;
let signer;
let xhelp, ihelp, dai, cdai, swapper

const fromBigNumber = (number, decimals) => {
  if (decimals == undefined) {
    return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)))
  }
  else {
    return parseFloat(ethersLib.utils.formatUnits(number, decimals));
  }
}

function dim() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.dim.call(chalk, ...arguments))
  }
}

function cyan() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.cyan.call(chalk, ...arguments))
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

function displayResult(name, result) {
  if (!result.newlyDeployed) {
    yellow(`Re-used existing ${name} at ${result.address}`)
  }
  else {
    green(`${name} deployed at ${result.address}`)
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
      return 'localhost';
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

module.exports = async({ getNamedAccounts, deployments, getChainId, ethers, upgrades }) => {

  const { deploy } = deployments;

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

  dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
  dim("Charity Contracts - Deploy Script")
  dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")

  const chainId = parseInt(await getChainId(), 10);
    
  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;

  dim(`deployer: ${deployer}`)
  dim(`chainId: ${chainId}`)

  userSigner = await ethers.provider.getSigner(userAccount)

  console.log(`signer: ${signer._address}`);

  // get the signer eth balance
  const balance = await ethers.provider.getBalance(signer._address);
  console.log(`signer balance: ${fromBigNumber(balance)}`);

  const ihelpAddress = (await deployments.get('iHelp')).address;
  ihelp = await ethers.getContractAt('iHelpToken', ihelpAddress, signer);

  const xhelpAddress = (await deployments.get('xHelp')).address;
  xhelp = await ethers.getContractAt('xHelpToken', xhelpAddress, signer);

  const swapperAddress = (await deployments.get('swapper')).address;
  //swapper = await ethers.getContractAt('swapper', swapperAddress, signer);

  console.log('');
  green('Signer Address:', signer._address);
  green('iHelp Address:', ihelpAddress);
  green('xHelp Address:', xhelpAddress);
  green('Swapper Address:', swapperAddress);
  console.log('')

  const getTokenAddresses = async(currency, lender) => {

    let ctokenaddress = null;
    let pricefeed = null;
    let tokenaddress = null;

    let addresses = fs.readFileSync(`./networks/${chainName(chainId)}-lending.json`, 'utf8');
    addresses = JSON.parse(addresses);

    if (isTestEnvironment && deployMockTokens) {

      const hardhatContracts = require('../../react-app/src/contracts/hardhat_contracts');
      
      if (currency == 'DAI') {
        tokenaddress = hardhatContracts[chainId.toString()][0]['contracts']['DAI']['address'];
        ctokenaddress = hardhatContracts[chainId.toString()][0]['contracts']['cDAI']['address'];
        pricefeed = addresses[lender]['PriceOracleProxy']['DAI'];
      }
      else if (currency == 'USDC') {
        tokenaddress = hardhatContracts[chainId.toString()][0]['contracts']['USDC']['address'];
        ctokenaddress = hardhatContracts[chainId.toString()][0]['contracts']['cUSDC']['address'];
        pricefeed = addresses[lender]['PriceOracleProxy']['USDC'];
      }
      else if (currency == 'HELP') {
        tokenaddress = hardhatContracts[chainId.toString()][0]['contracts']['iHelp']['address'];
        ctokenaddress = null;
        pricefeed = null;
      }

    }
    else {

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
      else if (currency == 'HELP') {
        const hardhatContracts = require('../../react-app/src/contracts/hardhat_contracts');
        tokenaddress = hardhatContracts[chainId.toString()][chainName(chainId).toLowerCase()]['contracts']['iHelp']['address'];
        ctokenaddress = null;
        pricefeed = null;
      }

    }

    return {
      "token": tokenaddress,
      "lendingtoken": ctokenaddress,
      "pricefeed": pricefeed
    };

  }

  // deploy charity - make this a function
  const ihelpAddresses = await getTokenAddresses('DAI', 'compound');
  const holdingtokenAddress = ihelpAddresses['token'];
  
  console.log(holdingtokenAddress)
  
  const deployedCharities = [];

  const deployCharityPool = async(contractName, charityName, charityWalletAddress, charityToken, lendingProtocol) => {

    const charityAddresses = await getTokenAddresses(charityToken, lendingProtocol);

    const charityResult = await deploy(contractName, {
      contract: 'CharityPool',
      proxy: {
        from: deployer,
        proxyContract: "OpenZeppelinTransparentProxy",
        execute: {
          init: {
            methodName: "initialize",
            args: [
              charityName, // pool name
              signer._address, // operator
              holdingPool, // holding pool address
              charityWalletAddress, // charity wallet address
              charityToken, // token as string
              charityAddresses['lendingtoken'], // lending token address
              holdingtokenAddress, // address of the holding token
              charityAddresses['pricefeed'], // chainlink price feed
              ihelpAddress, // ihelp token for getting interest
              swapperAddress, // swapper contract
              stakingPool, // staking pool
              developmentPool, // staking pool
            ]
          },
          onUpgrade: {
            methodName: "postUpgrade",
            args: []
          }
        }
      },
      from: deployer,
      skipIfAlreadyDeployed: skipIfAlreadyDeployed
    })

    deployedCharities.push([contractName, charityResult]);

    console.log('   deployed:', contractName, charityResult.address)

  }

  if (isTestEnvironment == true) {

    await deployCharityPool('charityPool1', 'Charity Pool 1', holdingPool, 'DAI', 'compound');
    await deployCharityPool('charityPool2', 'Charity Pool 2', holdingPool, 'USDC', 'compound');
    await deployCharityPool('charityPool3', 'Charity Pool 3', holdingPool, 'DAI', 'compound');

    console.log('deployedCharities:', deployedCharities.map((d) => { return [d[0], d[1].address] }))
    let numberOfCharities = await ihelp.numberOfCharities();
    if (numberOfCharities.toString() == '0') {
      for (let i = 0; i < deployedCharities.length; i++) {
        await ihelp.registerCharityPool(deployedCharities[i][1].address);
      }
    }

  }
  else {

    const mainnetInfura = new ethers.providers.StaticJsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");

    var long_id = "1lwHTt1C8tkm_LEHFv2kcqaTOgNFJ6U0p32M_j98zts0"
    var g_id = "313945428"
    var url = "https://docs.google.com/spreadsheets/d/" + long_id + "/export?gid=" + g_id + "&format=csv&id=" + long_id

    const response = await axios.get(url)
    const result = response.data
    const charityJson = await csv().fromString(result)

    // RUN ALL THE CHARITIES
    const charityJsonRun = charityJson;

    const deployCharity = async(ci) => {
      const c = charityJsonRun[ci];

      console.log(c['Organization Name'])

      await deployCharityPool(`${c['Organization Name']}-DAI-traderjoe`, c['Organization Name'], holdingPool, 'DAI', 'traderjoe');
      await deployCharityPool(`${c['Organization Name']}-USDC-traderjoe`, c['Organization Name'], holdingPool, 'USDC', 'traderjoe');
      //await deployCharityPool(`${c['Organization Name']}-USDT`, c['Organization Name'], holdingPool, 'USDT', 'aave');

      if (ci < charityJsonRun.length - 1) {
        await deployCharity(ci + 1)
      }
      else {

        const contractAddresses = [];
        deployedCharities.map((d) => { contractAddresses.push({ name: d[0], address: d[1].address }) });

        // console.log('\ndeployedCharities:');
        // console.log(contractAddresses);
        // console.log('');

        console.log('registering deployed charities with the ihelp protocol...')

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
        return csvWriter.writeRecords(contractAddresses).then(() => {})

      }
    }

    if (charityJsonRun.length > 0) {
      await deployCharity(0)
    }

  }

};

module.exports.tags = ["charityDeployment"];