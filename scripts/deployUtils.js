const fs = require('fs');
const { writeFileSync } = require('fs');
const path = require('path');
const ethersLib = require('ethers');
const chalk = require('chalk');
const Big = require('big.js');
const Web3 = require('web3');
const { readFileSync } = require("fs");
const web3 = new Web3('http://127.0.0.1:7545');
const { deployments, ethers, getNamedAccounts } = require("hardhat");
const ether = require('@openzeppelin/test-helpers/src/ether');
const readline = require('readline');


module.exports.saveConnector = async (name, address, network) => {
  const FILE_DIR = 'networks'
  if (!fs.existsSync(FILE_DIR)) {
    fs.mkdirSync(FILE_DIR);
  }

  const FILE_PATH = path.join(FILE_DIR, `${network}-connectors.json`);

  let connectors = {}
  if (fs.existsSync(FILE_PATH)) {
    const fileData = readFileSync(FILE_PATH, { encoding: 'utf-8' });
    connectors = JSON.parse(fileData);
  }

  connectors[name] = address;

  writeFileSync(FILE_PATH, JSON.stringify(connectors), "UTF-8", { 'flags': 'w' });

}

function breakArrayIntoGroups(data, maxPerGroup) {
  var numInGroupProcessed = 0;
  var groups = [
    []
  ];
  for (var i = 0; i < data.length; i++) {
    groups[groups.length - 1].push(data[i]);
    ++numInGroupProcessed;
    if (numInGroupProcessed >= maxPerGroup && i !== (data.length - 1)) {
      groups.push([]);
      numInGroupProcessed = 0;
    }
  }
  return groups;
}

module.exports.deployCharityPoolsToNetwork = async (configurations, network, factoryContractName = "CharityBeaconFactory") => {
  const FILE_DIR = 'build'
  if (!fs.existsSync(FILE_DIR)) {
    fs.mkdirSync(FILE_DIR);
  }

  const FILE_PATH = path.join(FILE_DIR, `${network}_charities.json`);

  let deployedCharities = [];
  let result = [];

  if (fs.existsSync(FILE_PATH)) {
    const fileData = readFileSync(FILE_PATH, { encoding: 'utf-8' });
    deployedCharities = JSON.parse(fileData);
  }

  const existing = [];
  for (const [index, configuration] of configurations.entries()) {
    const { charityName } = configuration;

    // can use this to regenerate the charities.json file if accidentally deleted
    // const deplo = await deployments.get(charityName);
    // deployedCharities.push({
    //     charityName: charityName,
    //     address: deplo.address
    // })

    const alreadyExists = deployedCharities.find(item => item.charityName === charityName);
    if (alreadyExists) {
      this.yellow(`   Charity ${charityName} was already deployed, skipping...`);
      result.push({ ...JSON.parse(JSON.stringify(alreadyExists)), exists: true })
      existing.push(index)
    }
  }

  // writeFileSync(FILE_PATH, JSON.stringify(deployedCharities), "UTF-8", { 'flags': 'a+' });

  const remaining = configurations.filter((_, index) => !existing.includes(index));

  if (remaining.length > 0) {

    const factoryDeployment = await deployments.get(factoryContractName);
    const factory = await ethers.getContractAt(factoryContractName, factoryDeployment.address);

    const BATCH_SIZE = 10;

    const groups = breakArrayIntoGroups(remaining, BATCH_SIZE);

    for (let i = 0; i < groups.length; i++) {

      const group = groups[i];

      console.log('\n   Processing group', i + 1, '/', groups.length);

      const tx = await factory.createCharityPool(group);

      const { events } = await tx.wait();
      const { args } = events.find(item => item.event === 'Created');
      const { newCharities } = args;

      for (const charity of newCharities) {
        result.push({
          charityName: charity.name,
          address: charity.addr,
          exists: false
        });
        deployedCharities.push({
          charityName: charity.name,
          address: charity.addr,
          exists: false
        })
        console.log('   deployed:', charity.name, '   to address  ', charity.addr, ' at network :', network);
      }

      writeFileSync(FILE_PATH, JSON.stringify(deployedCharities), "UTF-8", { 'flags': 'a+' });

    }

  }

  return result;
};

module.exports.getLendingConfigurations = async (chainId, forceLookup = false) => {
  let lendingConfiguration = fs.readFileSync(`./networks/${process.env.NETWORK_ADDRESSES || this.chainName(chainId)}-lending.json`, 'utf8');
  lendingConfiguration = JSON.parse(lendingConfiguration);

  let connectors = fs.readFileSync(`./networks/${process.env.NETWORK_ADDRESSES || this.chainName(chainId)}-connectors.json`, 'utf8');
  connectors = JSON.parse(connectors);

  for (const lender of Object.keys(lendingConfiguration)) {
    for (const coin of Object.keys(lendingConfiguration[lender])) {
      if (!connectors[lendingConfiguration[lender][coin]['connector']]) {
        this.red(`Warning: No ${chalk.yellow(`${lender} connctor found`)}, all currencies for this lender will be skipped...`)
        continue;
      }
      lendingConfiguration[lender][coin].connector = connectors[lendingConfiguration[lender][coin]['connector']];
    }
  }

  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;
  const deployMockTokens = process.env.REACT_APP_TEST_TOKENS || 'true';

  if (isTestEnvironment && deployMockTokens == 'true' && forceLookup == false) {
    for (const lender of Object.keys(lendingConfiguration)) {
      for (const coin of Object.keys(lendingConfiguration[lender])) {
        if (isTestEnvironment) {
          lendingConfiguration[lender][coin].underlyingToken = (await deployments.getOrNull(coin.replace('c', '').replace('j', '').replace('a', ''))).address;
          lendingConfiguration[lender][coin].lendingAddress = (await deployments.getOrNull(coin)).address;
        }
      }
    }
  }
  
  // console.log('lendingConfiguration',lendingConfiguration)
  
  return lendingConfiguration;
};

module.exports.fromBigNumber = (number, decimals) => {
  if (decimals == undefined) {
    return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)));
  }
  else {
    return parseFloat(ethersLib.utils.formatUnits(number, decimals));
  }
};

module.exports.dim = function() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.dim.call(chalk, ...arguments));
  }
};

module.exports.cyan = function() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.cyan.call(chalk, ...arguments));
  }
};

module.exports.yellow = function() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.yellow.call(chalk, ...arguments));
  }
};

module.exports.red = function() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.red.call(chalk, ...arguments));
  }
};


module.exports.green = function() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.green.call(chalk, ...arguments));
  }
};

module.exports.displayResult = function(name, result) {
  if (!result.newlyDeployed) {
    yellow(`Re-used existing ${name} at ${result.address}`);
  }
  else {
    green(`${name} deployed at ${result.address}`);
  }
};

module.exports.chainName = (chainId) => {
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
};

module.exports.getSwapAddresses = async(dex, chainId) => {
  let addresses = fs.readFileSync(`./networks/${process.env.NETWORK_ADDRESSES || this.chainName(chainId)}-dex.json`);
  addresses = JSON.parse(addresses);
  return addresses[dex];
};

module.exports.getNativeWrapper = async(chainId) => {

  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;
  const deployMockTokens = process.env.REACT_APP_TEST_TOKENS || 'true';

  if (isTestEnvironment && deployMockTokens == 'true') {
    try {
      const hardhatContracts = require(`../build/hardhat_contracts`);
      return hardhatContracts[chainId.toString()][0]['contracts']['WETH']['address'];
    }
    catch (e) {
      this.yellow('   WARNING - no NativeWrapper found... cannot wrap currency')
      return '0x0000000000000000000000000000000000000000'
    }
  }
  else {
    const configurations = await this.getLendingConfigurations(chainId);
    for (const lender of Object.keys(configurations)) {
      for (const coin of Object.keys(configurations[lender])) {
        if (coin.replace('c', '').replace('j', '').replace('a', '') == 'WETH' || coin.replace('c', '').replace('j', '').replace('a', '') == 'WAVAX') {
          return configurations[lender][coin]['underlyingToken']
        }
      }
    }
  }

}

module.exports.addDonationCurrencies = async(currencies) => {
  const { deployer } = await getNamedAccounts();

  const priceFeedProviderDeployment = await deployments.getOrNull("priceFeedProvider");
  if (!priceFeedProviderDeployment) {
    this.yellow('   WARNING - no priceFeedProvider found... cannot add currencies')
    return;
  }
  this.yellow(`Using PriceFeedProvider at ${priceFeedProviderDeployment.address}...`);

  const signer = await ethers.getSigner(deployer);
  const PriceFeedProvider = await ethers.getContractAt("PriceFeedProvider", priceFeedProviderDeployment.address, signer);

  const skipped = [];
  for (let index = 0; index < currencies.length; index++) {
    const currency = currencies[index];

    process.stdout.write(`\n ${chalk.gray(`Verifying ${currency.currency} at ${currency.lender} (${currency.lendingAddress}) ...`)}`);
    const exists = await PriceFeedProvider.hasDonationCurrency(currency.lendingAddress);

    if (exists) {
      process.stdout.write(`${chalk.yellow(` Already exists, skipping ...`)}`);
      skipped[index] = true;
    }
    else {
      process.stdout.write(` ✅`);
    }
  }
  process.stdout.write(`\n`);

  const requestData = currencies
    .filter((_, index) => !skipped[index])
    .map(item => ({
      provider: item.lender,
      currency: item.currency,
      underlyingToken: item.underlyingToken,
      lendingAddress: item.lendingAddress,
      priceFeed: item.priceFeed,
      connector: item.connector
    }));

  console.log(`\n ${chalk.gray(`Adding `)} ${chalk.yellow(`${requestData.map(item => item.currency).join(', ')}`)}... \n`);

  await PriceFeedProvider.addDonationCurrencies(requestData);
}

module.exports.updateCharityPoolsDefaultConfig = async () => {
  const { deployer } = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer);

  const chainId = parseInt(await getChainId(), 10);
  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;

  const holdingToken = 'DAI';
  let holdingTokenAddress = null;
  if (isTestEnvironment) {
    holdingTokenAddress = (await deployments.getOrNull(holdingToken)).address;
  }
  else {
    const configurations = await this.getLendingConfigurations(chainId);
    for (const lender of Object.keys(configurations)) {
      for (const coin of Object.keys(configurations[lender])) {
        if (coin.replace('.e', '').replace('c', '').replace('j', '').replace('a', '') == holdingToken) {
          holdingTokenAddress = configurations[lender][coin]['underlyingToken']
          break
        }
      }
    }
  }


  const ihelpAddress = (await deployments.get('iHelp')).address;
  ihelp = await ethers.getContractAt('iHelpToken', ihelpAddress, signer);

  const swapperAddress = (await deployments.get('swapper')).address;
  const priceFeedProviderAddresss = (await deployments.get('priceFeedProvider')).address;
  const nativeWrapper = await this.getNativeWrapper(chainId);

  const defaultConfig = {
    charityName: "1",
    operatorAddress: signer.address,
    charityWalletAddress: ethersLib.constants.AddressZero,
    holdingTokenAddress,
    ihelpAddress,
    swapperAddress: swapperAddress,
    priceFeedProvider: priceFeedProviderAddresss,
    wrappedNativeAddress: nativeWrapper
  }

  console.log(`${chalk.gray(`Updating the configuration to`)} : ${chalk.yellow(JSON.stringify(defaultConfig, null, 2))}`);

  const beaconFactoryDeployment = await deployments.get("CharityBeaconFactory");

  this.yellow(`${chalk.gray(`Using beacon factory at`)} (${beaconFactoryDeployment.address})`);

  const beaconFactory = await ethers.getContractAt("CharityBeaconFactory", beaconFactoryDeployment.address, signer);
  const owner = await beaconFactory.owner();

  if (owner === deployer) {
    this.yellow(`${chalk.gray(`Updating config...`)} (${beaconFactoryDeployment.address})`);
    await beaconFactory.setDefaultCharityConfiguration(defaultConfig);
  }
  else {
    const { data } = await beaconFactory.populateTransaction.setDefaultCharityConfiguration(defaultConfig);
    console.log(chalk.gray(`\nAccount ${chalk.yellow(deployer)} does not have permission to execute the update. \nBroadcast the following tx from ${chalk.yellow(owner)} to execute the update :
  
          ${chalk.yellow(`${data}`)}
      `));
  }
}

module.exports.updateCharityPools = async () => {
  const { deployer } = await getNamedAccounts();

  const network = process.env.REACT_APP_NETWORK;

  const result = await deployments.deploy('CharityPool_Implementation', {
    contract: 'CharityPool',
    from: deployer,
    args: [],
    log: true,
  });

  address = result.address

  if (!result.newlyDeployed) {
    this.yellow(`${chalk.gray(`Reusing deployment`)} (${address})`);
  }

  const beaconFactoryDeployment = await deployments.get("CharityBeaconFactory");
  const signer = await ethers.getSigner(deployer);
  this.yellow(`${chalk.gray(`Using beacon factory at`)} (${beaconFactoryDeployment.address})`);

  const beaconFactory = await ethers.getContractAt("CharityBeaconFactory", beaconFactoryDeployment.address, signer);
  const owner = await beaconFactory.owner();
  if (owner === deployer) {
    this.yellow(`${chalk.gray(`Updating beacon to address`)} (${beaconFactoryDeployment.address})`);
    await beaconFactory.update(address);
  }
  else {
    const { data } = await beaconFactory.populateTransaction.update(address);
    console.log(chalk.gray(`\nAccount ${chalk.yellow(deployer)} does not have permission to execute the update. \nBroadcast the following tx from ${chalk.yellow(owner)} to ${chalk.yellow(beaconFactoryDeployment.address)}:
        
        ${chalk.yellow(`${data}`)}
    `));

    if (network == 'localhost') {
      await mockUpgrade(beaconFactoryDeployment.address, data);
    }

  }

  const updateCharityABIs = true;

  if (updateCharityABIs) {

    this.cyan('\nUpdating the charity pool abi definitions to match the latest implementation...\n');

    // update the charity abi in the deployments directory and in the build file
    
    const baseAbi = JSON.parse(await fs.readFileSync(`deployments/${network}/CharityPool_Implementation.json`,'utf8'))['abi']
    // console.log(baseAbi)

    const FILE_DIR = 'build'
    const FILE_PATH = path.join(FILE_DIR, `${network}_charities.json`);

    let deployedCharities = [];
    let result = [];

    if (fs.existsSync(FILE_PATH)) {
      const fileData = readFileSync(FILE_PATH, { encoding: 'utf-8' });
      deployedCharities = JSON.parse(fileData);
    }

    for (const charity of deployedCharities) {
        // this.yellow('  updating abi:',charity['charityName'])

        const deployFile = `deployments/${network}/${charity['charityName']}.json`;

        const deployment = JSON.parse(readFileSync(deployFile, { encoding: 'utf-8' }));
        deployment['abi'] = baseAbi;

        await fs.writeFileSync(deployFile,JSON.stringify(deployment, null, 2));

    }
  
    this.cyan('\nExporting the deployments...')

    // publish the contracts
    const exec = require('child_process').exec;
  
    function os_func() {
      this.execCommand = function(cmd) {
        return new Promise((resolve, reject) => {
          exec(cmd, (error, stdout, stderr) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(stdout);
          });
        });
      };
    }

    var os = new os_func();
    this.cyan(`hardhat export --export-all ./build/${network}_contracts.json`);
    await run('export', { "exportAll": `./build/${network}_contracts.json` });

  }

}

module.exports.fromBigNumber = (number) => {
  return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)))
}

const mockUpgrade = async(to, data) => {

  this.cyan('\nStarting Impersonated Upgrade...\n')

  const proxyAdminOwner = process.env.PROXY_ADMIN_OWNER;
  this.yellow('proxyAdminOwner', proxyAdminOwner)

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [proxyAdminOwner],
  });
  const signer = await ethers.provider.getSigner(proxyAdminOwner);

  const balance = await signer.getBalance();
  console.log('   proxyAdmin Balance:', this.fromBigNumber(balance))

  if (balance == 0) {
    console.log('   sending proxy admin some funds')
    let {
      deployer,
    } = await getNamedAccounts();

    deployer_signer = await ethers.provider.getSigner(deployer);

    let tx = {
      to: proxyAdminOwner,
      value: ethers.utils.parseEther('1')
    }
    await deployer_signer.sendTransaction(tx)

    this.yellow('   New ProxyAdmin Balance:', this.fromBigNumber(await signer.getBalance()))

  }

  const tx = {
    to: to,
    value: "0",
    data: data,
  }

  const t = await signer.sendTransaction(tx)

  this.green('\nmock upgrade complete\n')

}


module.exports.runRpcTest = async() => {

  console.log('\nstarting rpc test for rate limiting...')
  class LoggingProvider extends ethers.providers.JsonRpcProvider {
      perform(method, parameters) {
          console.log("  >>>", method, parameters);
          return super.perform(method, parameters).then((result) => {
              console.log("  <<<", method, parameters, result);
              return result;
          });
      }    
  }

  // before doing anything try to call a request with ethers for exponential backoff
  const nodeUrl = process.env.REACT_APP_RPC_URL;
  if (nodeUrl == '' || nodeUrl == undefined) {
      console.log('please define REACT_APP_RPC_URL env variable - exiting')
      process.exit(1)
  }
  
  // const providerTest = new ethers.providers.JsonRpcProvider(nodeUrl)
  const providerTest = new LoggingProvider(nodeUrl)
  await providerTest.getBlockNumber();
  console.log('rpc provider ready.\n');

}