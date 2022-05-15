module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const ihelpToken = await deployments.get('iHelp');
  await deploy('TokenVesting', {
    contract: 'TokenVesting',
    proxy: {
      from: deployer,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [ihelpToken.address]
        }
      }
    }
  });
};

module.exports.tags = ['VestingDeployment'];
module.exports.dependencies = ["iHelpDeployment"];