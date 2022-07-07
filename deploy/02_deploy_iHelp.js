const { dim, green, chainName, getTokenAddresses, yellow } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const chainId = parseInt(await getChainId(), 10);
  yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow("Protocol Contracts - Deploy Script for IHelp");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");


  const { deploy, catchUnknownSigner, get } = deployments;
  const {
    deployer,
    stakingPool,
    developmentPool,
    holdingPool,
    proxyAdmin
  } = await getNamedAccounts();


  dim(`network: ${chainName(chainId)}`);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  // deploy the iHelp token
  const ihelpAddresses = await getTokenAddresses('DAI', 'compound', chainId);
  const holdingtokenAddress = ihelpAddresses['token'];
  const PriceFeedProvider = await deployments.get("priceFeedProvider");

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
              stakingPool, // 15% of interest
              developmentPool, // 5% of interest
              holdingPool, // 20% of interest
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
module.exports.dependecies = ['Mocks', 'PriceFeedProvider'];