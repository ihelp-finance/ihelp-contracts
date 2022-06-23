const { chainName, dim, yellow, green } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const chainId = parseInt(await getChainId(), 10);

  const { deploy, catchUnknownSigner } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  const ihelpToken = await deployments.get('iHelp');
  dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  dim("Protocol Contracts - Deploy Script for Analytics");
  dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network: ${chainName(chainId)} `);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  await catchUnknownSigner(
    deploy('analytics', {
      contract: 'Analytics',
      from: deployer,
      log: true,
      proxy: {
        proxyContract: "OpenZeppelinTransparentProxy",
        owner: proxyAdmin,
        execute: {
          init: {
            // methodName: "initialize",
            // args: []
          }
        }
      },
    }), { log: true }
  );

  yellow(`--- Initialized Analytics Contract ---`);

  const analyticsResult = await deployments.get('Analytics');
  const analyticsAddress = analyticsResult.address;

  green('Analytics Proxy:', analyticsAddress);
  green('Analytics Implementation:', analyticsResult.implementation);
};


module.exports.tags = ['AnalyticsDeployment'];
module.exports.dependencies = ["iHelpDeployment"];