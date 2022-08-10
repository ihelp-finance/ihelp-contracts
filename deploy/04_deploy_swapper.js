const { dim, green, getSwapAddresses, chainName, yellow, getLendingConfigurations } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const chainId = parseInt(await getChainId(), 10);

  yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow("Protocol Contracts - Deploy Script for Swapper");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");


  const { deploy, catchUnknownSigner } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  dim(`network: ${chainName(chainId)}`);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);
  
  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;
  const deployMockTokens = process.env.REACT_APP_TEST_TOKENS || 'true';

  const swapperAddresses = await getSwapAddresses(process.env.SWAPPER_ADDRESSES || 'uniswap', chainId);
  
  let nativeTokenAddress = null;
  if (isTestEnvironment && deployMockTokens == 'true') {
    nativeTokenAddress = (await deployments.getOrNull('WETH')).address;
  }
  else {
    const configurations = await getLendingConfigurations(chainId);
    for (const lender of Object.keys(configurations)) {
      for (const coin of Object.keys(configurations[lender])) {
        if (coin.replace('c','').replace('j','').replace('a','') == 'WETH' || coin.replace('c','').replace('j','').replace('a','') == 'WAVAX') {
          nativeTokenAddress = configurations[lender][coin]['underlyingToken']
          break
        }
      }
    }
  }

  // deploy the swapper
  await catchUnknownSigner(
    deploy("swapper", {
      contract: 'Swapper',
      proxy: {
        proxyContract: "OpenZeppelinTransparentProxy",
        owner: proxyAdmin,
        execute: {
          init: {
            methodName: "initialize",
            args: [swapperAddresses['router'],nativeTokenAddress]
          }
        }
      },
      from: deployer,
    })
  );

  yellow(`--- Initialized Swapper Contract ---`);

  const swapperResult = await deployments.get('swapper');
  const swapperAddress = swapperResult.address;

  green('swapper Proxy:', swapperAddress);
  green('swapper Router:', swapperAddresses['router']);
  green('swapper Implementation:', swapperResult.implementation);
};

module.exports.tags = ['swapper'];