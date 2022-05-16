const { chainName, dim, yellow } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments, getTokenAddresses }) => {
  const chainId = parseInt(await getChainId(), 10);

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow("Protocol Contracts - Deploy Script for Charity Pool Factory");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network: ${chainName(chainId)} `);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  await deploy('CharityPoolCloneFactory', {
    contract: 'CharityPoolCloneFactory',
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports.tags = ['FactoryDeployments'];