const { dim, green, chainName, yellow, cyan, addDonationCurrencies, getLendingConfigurations } = require("../scripts/deployUtils");

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
  const deployMockTokens = process.env.REACT_APP_TEST_TOKENS || 'true';
  
  // We deploy a mocked version of the price provider which will always return 1 as the price of any call
  const contract = isTestEnvironment && deployMockTokens == 'true' ? 'PriceFeedProviderMock' : 'PriceFeedProvider';
  
  yellow(`\nDeploying ${contract} Contract\n`);

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
            args: [[]] // initialize the currencies after deployment
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

  const configurations = await getLendingConfigurations(chainId);
  const currencies = [];

  for (const lender of Object.keys(configurations)) {
      for (const token of Object.keys(configurations[lender])) {
          currencies.push({
              "currency": token.replace('c','').replace('a','').replace('j',''),
              "lender": lender,
              "underlyingToken": configurations[lender][token].underlyingToken,
              "lendingAddress": configurations[lender][token].lendingAddress,
              "priceFeed":  configurations[lender][token].priceFeed,
              "connector":  configurations[lender][token].connector
          })
      }
  }
  cyan(`\nadding ${currencies.length} supported currencies to the protocol...`);
  
  await addDonationCurrencies(currencies);
  console.log("✅  Success ");
  
};
module.exports.dependencies = ['connectors'];
module.exports.tags = ['PriceFeedProvider'];