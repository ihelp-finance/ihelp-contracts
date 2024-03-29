const { dim, green, getSwapAddresses, chainName, yellow, getLendingConfigurations, cyan } = require("../scripts/deployUtils");

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

  const swapperAddresses = await getSwapAddresses(process.env.SWAPPER_ADDRESSES || 'traderjoe', chainId);
  const swapv2RouterAddress = swapperAddresses['router'];

  const mainnetInfura = new ethers.providers.StaticJsonRpcProvider(process.env.TEST_FORK);
  
  
  let nativeTokenAddress = null;
  if ( (process.env.SWAPPER_ADDRESSES || 'traderjoe') == 'traderjoe') {
    
    const abi = [
      {
        "inputs": [],
        "name": "WAVAX",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      }
    ]
    
    const swapv2Router = new ethers.Contract(swapv2RouterAddress, abi, mainnetInfura);
    
    nativeTokenAddress = await swapv2Router.WAVAX();
  }
  else {
    
    const abi = [
      {
        "inputs": [],
        "name": "WETH",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      }
    ]
    
    const swapv2Router = new ethers.Contract(swapv2RouterAddress, abi, mainnetInfura);
    
    nativeTokenAddress = await swapv2Router.WETH();
  }
  
  cyan(`\nNative Token Address: ${nativeTokenAddress}\n`);
  
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
            args: [swapperAddresses['router'], nativeTokenAddress]
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