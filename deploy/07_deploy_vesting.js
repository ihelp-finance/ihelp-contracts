const { chainName, dim, yellow, green } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const chainId = parseInt(await getChainId(), 10);

  const { deploy, catchUnknownSigner } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  const ihelpToken = await deployments.get('iHelp');
  dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  dim("Protocol Contracts - Deploy Script for Vesting");
  dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network: ${chainName(chainId)} `);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  await catchUnknownSigner(
    deploy('TokenVesting', {
      contract: 'TokenVesting',
      from: deployer,
      log: true,
      proxy: {
        proxyContract: "OpenZeppelinTransparentProxy",
        owner: proxyAdmin,
        execute: {
          init: {
            methodName: "initialize",
            args: [ihelpToken.address]
          }
        }
      },
    }), { log: true }
  );

  yellow(`--- Initialized TokenVesting Contract ---`);

  const tokenVestingResult = await deployments.get('TokenVesting');
  const tokenVestingAddress = tokenVestingResult.address;

  green('TokenVesting Proxy:', tokenVestingAddress);
  green('TokenVesting Implementation:', tokenVestingResult.implementation);
};


module.exports.tags = ['VestingDeployment'];
module.exports.dependencies = ["iHelpDeployment"];