const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { parseEther } = require('ethers/lib/utils');
const { dim, red, yellow, cyan, fromBigNumber, chainName, getLendingConfigurations, getSwapAddresses, green } = require('../scripts/deployUtils');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: 'contractAddresses.csv',
  header: [
    { id: 'name', title: 'Contract' },
    { id: 'address', title: 'Address' },
  ],
  append: false
});

async function getPair(swapv2Factory, signer, token1Address, token2Address) {
  let pair = await swapv2Factory.connect(signer).getPair(token1Address, token2Address);
  dim('   pair', pair);

  try {
    if (pair === ZERO_ADDRESS) {
      dim("    creating pair");
      const createPairTx = await swapv2Factory.connect(signer).createPair(token1Address, token2Address);
      await createPairTx.wait();
      dim('   pair created');
      pair = await swapv2Factory.connect(signer).getPair(token1Address, token2Address);
      dim('   new pair', pair);
    }
  }
  catch (e) {
    console.log(e);
  }
  return pair;
}

module.exports = async({ getNamedAccounts, deployments, getChainId, ethers }) => {
  let {
    deployer,
    developmentPool,
    proxyAdmin
  } = await getNamedAccounts();

  console.log('');

  const chainId = parseInt(await getChainId(), 10);

  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;

  const deployMockTokens = process.env.TEST_TOKENS || 'true';

  const signer = await ethers.provider.getSigner(deployer);

  console.log(`signer: ${signer._address}`);

  // get the signer eth balance
  const balance = await ethers.provider.getBalance(signer._address);
  console.log(`signer balance: ${fromBigNumber(balance)}`);


  yellow
    ("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow
    ("Protocol Contracts - Post Deploy Script");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network: ${chainName(chainId)}`);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);


  // if using mock tokens, create the uniswap pair liquidity pool

  const IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json");
  const IUniswapV2Pair = require("@uniswap/v2-core/build/IUniswapV2Pair.json");
  const IUniswapV2Router02 = require("@uniswap/v2-periphery/build/IUniswapV2Router02.json");

  const swapperAddresses = await getSwapAddresses('uniswap', chainId);
  const swapv2FactoryAddress = swapperAddresses['factory'];
  const swapv2RouterAddress = swapperAddresses['router'];

  console.log('router', swapv2RouterAddress);
  console.log('factory', swapv2FactoryAddress);

  //const mainnetInfura = new ethers.providers.StaticJsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
  const mainnetInfura = new ethers.providers.StaticJsonRpcProvider("https://eth-rinkeby.alchemyapi.io/v2/UipRFhJQbBiZ5j7lbcWt46ex5CBjVBpW");
  const swapv2Factory = new ethers.Contract(swapv2FactoryAddress, IUniswapV2Factory['abi'], mainnetInfura);
  const swapv2Router = new ethers.Contract(swapv2RouterAddress, IUniswapV2Router02['abi'], mainnetInfura);

  const userSigner = signer;
  const userAccount = deployer;

  // activate the LP 

  const activateETHLiquidityPool = async(token, value, dex) => {

    const token1Address = token['underlyingToken'];

    const ethAddress = await swapv2Router.WETH();

    console.log('');
    dim(token.name, '->', 'ETH');
    dim(token1Address, '->', ethAddress);

    let token1contract;
    if (token.name == 'HELP') {
      token1contract = await ethers.getContractAt('iHelpToken', token1Address, signer);
    }
    else {
      token1contract = await ethers.getContractAt('ERC20MintableMock', token1Address, signer);
    }

    const decimals = await token1contract.decimals();

    let pair = await getPair(swapv2Factory, signer, token1Address, ethAddress)
    dim('   pair', pair);
    const swapv2Pair1 = new ethers.Contract(pair, IUniswapV2Pair['abi'], mainnetInfura);
    let pairSupply = await getPairSupply(swapv2Pair1, signer, 18, decimals);
    dim('   pairSupply', pairSupply);

    if (pairSupply == 0) {

      const currentBalance1 = await token1contract.balanceOf(userAccount);

      if (fromBigNumber(currentBalance1, decimals) < parseFloat(value) || fromBigNumber(currentBalance1, decimals) == 0) {
        if (token.name == 'HELP') {
          console.log('minting help tokens...');
          const MintTx1 = await token1contract.mint(userAccount, ethers.utils.parseUnits(value, decimals));
          await MintTx1.wait();
        }
        else {
          console.log('minting token1...');
          const MintTx1 = await token1contract.allocateTo(userAccount, ethers.utils.parseUnits(value, decimals));
          await MintTx1.wait();
        }
      }

      // add liquidity to the pair
      let devTx1Approve = await token1contract.connect(userSigner).approve(swapv2RouterAddress, ethers.utils.parseUnits(value, decimals));
      //console.log(devTx1Approve['hash']);
      await devTx1Approve.wait();

      const timestamp = (await mainnetInfura.getBlock()).timestamp;
      console.log('Adding liquidity...', timestamp);

      const addLiquid = await swapv2Router.connect(userSigner)
        .addLiquidityETH(token1Address,
          ethers.utils.parseUnits(value, decimals),
          ethers.utils.parseUnits(value, decimals),
          0,
          userAccount, timestamp + 3000000, {
            value: parseEther('500')
          });

      await addLiquid.wait();

      let pairSupply1 = 0;
      try {
        pairSupply1 = await swapv2Pair1.connect(userSigner).totalSupply();
        pairSupply1 = fromBigNumber(pairSupply1, 18 - decimals > 0 ? 18 - decimals : 18);
      }
      catch (e) {
        console.log(e)
      }
      dim('   new pairSupply', pairSupply1);

    }

  };

  const activateLiquidityPool = async(token1, token2, token1value, token2value, dex) => {

    const token1Address = token1['underlyingToken'];
    const token2Address = token2['underlyingToken'];

    console.log('');
    dim(token1.name, '->', token2.name);
    dim(token1Address, '->', token2Address);

    let token1contract;
    if (token1.name == 'HELP') {
      token1contract = await ethers.getContractAt('iHelpToken', token1Address, signer);
    }
    else {
      token1contract = await ethers.getContractAt('ERC20MintableMock', token1Address, signer);
    }
    const token2contract = await ethers.getContractAt('ERC20MintableMock', token2Address, signer);

    const token1decimals = await token1contract.decimals();
    const token2decimals = await token2contract.decimals();

    //console.log(token1value,token2value)
    //console.log(token1decimals,token2decimals)

    let pair = await getPair(swapv2Factory, signer, token1Address, token2Address);
    const swapv2Pair1 = new ethers.Contract(pair, IUniswapV2Pair['abi'], mainnetInfura);

    let pairSupply = await getPairSupply(swapv2Pair1, signer, token2decimals, token1decimals);
    dim('   pairSupply', pairSupply);

    if (pairSupply == 0) {

      const currentBalance1 = await token1contract.balanceOf(userAccount);
      if (fromBigNumber(currentBalance1, token1decimals) <= parseFloat(token1value) || fromBigNumber(currentBalance1, token1decimals) == 0) {
        if (token1.name == 'HELP') {
          console.log('minting help tokens...');
          const MintTx1 = await token1contract.mint(userAccount, ethers.utils.parseUnits(token1value, token1decimals));
          await MintTx1.wait();
        }
        else {
          console.log('minting token1...');
          const MintTx1 = await token1contract.allocateTo(userAccount, ethers.utils.parseUnits(token1value, token1decimals));
          await MintTx1.wait();
        }
      }
      console.log('minting token1... success');

      const currentBalance2 = await token2contract.balanceOf(userAccount);
      if (fromBigNumber(currentBalance2, token2decimals) <= parseFloat(token2value) || fromBigNumber(currentBalance2, token2decimals) == 0) {
        console.log('minting token2...');
        const MintTx2 = await token2contract.allocateTo(userAccount, ethers.utils.parseUnits(token2value, token2decimals));
        await MintTx2.wait();
      }

      // add liquidity to the pair
      let devTx1Approve = await token1contract.connect(userSigner).approve(swapv2RouterAddress, ethers.utils.parseUnits(token1value, token1decimals));
      //console.log(devTx1Approve['hash']);
      await devTx1Approve.wait();

      let devTx2Approve = await token2contract.connect(userSigner).approve(swapv2RouterAddress, ethers.utils.parseUnits(token2value, token2decimals));
      //console.log(devTx2Approve['hash']);
      await devTx2Approve.wait();


      const timestamp = (await mainnetInfura.getBlock()).timestamp;
      console.log('Adding liquidity...', timestamp);

      const addLiquid = await swapv2Router.connect(userSigner).addLiquidity(token1Address, token2Address, ethers.utils.parseUnits(token1value, token1decimals), ethers.utils.parseUnits(token2value, token2decimals), ethers.utils.parseUnits(token1value, token1decimals), ethers.utils.parseUnits(token2value, token2decimals), userAccount, timestamp + 3000000);
      await addLiquid.wait();

      let pairSupply1 = 0;
      try {
        pairSupply1 = await swapv2Pair1.connect(userSigner).totalSupply();
        pairSupply1 = fromBigNumber(pairSupply1, token2decimals - token1decimals > 0 ? token2decimals - token1decimals : token2decimals);
      }
      catch (e) {}
      dim('   new pairSupply', pairSupply1);

    }

  };

  // await activateLiquidityPool('HELP', 'DAI', '125000', '150000', 'aave', 'traderjoe');

  if (isTestEnvironment && deployMockTokens == 'true') {

    if (process.env.TEST_FORK == '' || process.env.TEST_FORK == undefined) {
      red('\nWARNING - not deploying test liquidity pools becuase there is no forked router. Please fork to use the swapper...')
    }
    else {

      yellow('\nActivating liquidity pools for test environment...');

      const priceFeedProviderDeployment = await deployments.getOrNull("priceFeedProvider");
      if (!priceFeedProviderDeployment) {
        yellow('   WARNING - no priceFeedProvider found... cannot add currencies')
        return;
      }
      yellow(`Using PriceFeedProvider at ${priceFeedProviderDeployment.address}...`);

      const signer = await ethers.getSigner(deployer);
      const PriceFeedProvider = await ethers.getContractAt("PriceFeedProvider", priceFeedProviderDeployment.address, signer);

      const currencies = await PriceFeedProvider.getAllDonationCurrencies()

      const configurations = await getLendingConfigurations(chainId);

      const holdingTokenName = 'DAI';

      let holdingToken = null
      for (const coin of currencies) {
        if (coin['currency'] == holdingTokenName) {
          holdingToken = {
            underlyingToken: coin['underlyingToken'],
            name: coin['currency']
          }
        }
      }

      const currencyNames = [];
      for (const coin of currencies) {

        if (currencyNames.indexOf(coin['currency']) == -1) {
          
          currencyNames.push(coin['currency'])

          const token = {
            underlyingToken: coin['underlyingToken'],
            name: coin['currency']
          }

          await activateETHLiquidityPool(token, '50000000', 'uniswap');

          if (coin['currency'] != holdingTokenName) {
            await activateLiquidityPool(token, holdingToken, '50000000', '50000000', 'uniswap');
          }

        }

      }

    }

  }

  async function getAddress(contractName) {
    const deployment = await deployments.get(contractName);
    return deployment.address;
  }

  const ihelpAddress = await getAddress('iHelp');
  const xhelpAddress = await getAddress('xHelp');
  const swapperAddress = await getAddress('swapper');
  const analyticsAddress = await getAddress('analytics');

  console.log('');
  green('Signer Address:', signer._address);
  green('iHelp Address:', ihelpAddress);
  green('xHelp Address:', xhelpAddress);
  green('Swapper Address:', swapperAddress);
  green('Analytics Address:', analyticsAddress);
  green('Development Pool Address:', developmentPool);
  green('');

  const contractAddresses = [
    { name: 'Signer', address: signer._address },
    { name: 'iHelp', address: ihelpAddress },
    { name: 'xHelp', address: xhelpAddress },
    { name: 'Swapper', address: swapperAddress },
    { name: 'Analytics', address: analyticsAddress },
    { name: 'Development Pool', address: developmentPool },
  ];

  // write the key addresses to a csv file
  return csvWriter.writeRecords(contractAddresses).then(() => {});

};
module.exports.tags = ["PostDeploy"];
module.exports.runAtTheEnd = true;


async function getPairSupply(swapv2Pair1, signer, token2decimals, token1decimals) {
  let pairSupply1 = 0;
  try {
    pairSupply1 = await swapv2Pair1.connect(signer).totalSupply();
    pairSupply1 = fromBigNumber(pairSupply1, token2decimals - token1decimals > 0 ? token2decimals - token1decimals : token2decimals);
  }
  catch (e) {
    console.log(e);
  }
  return pairSupply1;
}
