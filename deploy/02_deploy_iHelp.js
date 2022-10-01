const { dim, green, chainName, getLendingConfigurations, yellow } = require("../scripts/deployUtils");

module.exports = async({ getNamedAccounts, deployments, getChainId }) => {
  const chainId = parseInt(await getChainId(), 10);
  yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow("Protocol Contracts - Deploy Script for IHelp");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");


  const { deploy, catchUnknownSigner, get } = deployments;
  const {
    deployer,
    developmentPool,
    proxyAdmin
  } = await getNamedAccounts();


  dim(`network: ${chainName(chainId)}`);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;
  const deployMockTokens = process.env.REACT_APP_TEST_TOKENS || 'true';

  // deploy the iHelp token
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
  
  const PriceFeedProvider = await deployments.get("priceFeedProvider");

  console.log(['iHelp Token',
    'HELP',
    deployer, // operator
    developmentPool, // 5% of interest
    holdingtokenAddress, // underlying dai token for ihelp transfer
    PriceFeedProvider.address // the price feed provider address
  ])
  
  await catchUnknownSigner(
    deploy("iHelp", {
      contract: 'iHelpToken',
      proxy: {
        owner: proxyAdmin,
        proxyContract: "OpenZeppelinTransparentProxy",
        execute: {
          init: {
            methodName: "initialize",
            args: ['iHelp Token',
              'HELP',
              deployer, // operator
              developmentPool, // 5% of interest
              holdingtokenAddress, // underlying dai token for ihelp transfer
              PriceFeedProvider.address // the price feed provider address
            ]
          },
          onUpgrade: {
            methodName: "postUpgrade",
            args: []
          }
        }
      },
      log: true,
      from: deployer,
    })
  );

  yellow(`--- Initialized iHelp Token ---`);

  const ihelpResult = await deployments.get('iHelp');
  const ihelpAddress = ihelpResult.address;

  green('iHelp Proxy:', ihelpAddress);
  green('iHelp Implementation:', ihelpResult.implementation);
};

module.exports.tags = ['iHelp'];
module.exports.dependecies = ['Mocks', 'PriceFeedProvider', 'xHelp'];