const { dim, green, getSwapAddresses, chainName, yellow, getTokenAddresses } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const chainId = parseInt(await getChainId(), 10);

  yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow("Protocol Contracts - Deploy Script for Price Feed Provider");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");


  const { deploy, catchUnknownSigner } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  dim(`network: ${chainName(chainId)}`);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;
  let lendingTokenDetails
  if (isTestEnvironment) {
    lendingTokenDetails = [await getTokenAddresses('DAI', 'compound', chainId), await getTokenAddresses('USDC', 'compound',chainId), await getTokenAddresses('WETH', 'compound',chainId)]
  } else {
    
    lendingTokenDetails = [
      await getTokenAddresses('DAI', 'compound', chainId), 
      await getTokenAddresses('USDC', 'compound',chainId), 
      await getTokenAddresses('USDT', 'compound',chainId),
      await getTokenAddresses('BAT', 'compound',chainId),
      await getTokenAddresses('ZRX', 'compound',chainId),
    ]
    
  }

  lendingTokenDetails = lendingTokenDetails.map(item => ({
    provider: item.lender,
    currency: item.currency,
    underlyingToken: item.underlyingToken,
    lendingAddress: item.lendingAddress,
    priceFeed: item.priceFeed
  }));

  console.log(lendingTokenDetails)

  // We deploy a mocked version of the price provider which will always return 1 as the price of any call
  const contract = isTestEnvironment ? 'PriceFeedProviderMock' : 'PriceFeedProvider';

  // deploy the iHelp token
  await catchUnknownSigner(
    deploy("priceFeedProvider", {
      contract,
      proxy: {
        proxyContract: "OpenZeppelinTransparentProxy",
        owner: proxyAdmin,
        execute: {
          init: {
            methodName: "initialize",
            args: [lendingTokenDetails]
          }
        }
      },
      from: deployer,
    })
  );

  yellow(`--- Initialized PriceFeedProvider Contract ---`);

  const result = await deployments.get('priceFeedProvider');
  const address = result.address;

  green('PriceFeedProvider Proxy:', address);
  green('PriceFeedProvider Implementation:', result.implementation);
};

module.exports.tags = ['PriceFeedProvider'];