const { chainName, dim, yellow } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const chainId = parseInt(await getChainId(), 10);

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow("Protocol Contracts - Deploy Script for Charity Pool Factories");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network: ${chainName(chainId)} `);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  await deploy('CharityPool_Implementation', {
    contract: 'CharityPool',
    from: deployer,
    args: [],
    log: true,
  });

  const charityPool = await deployments.get('CharityPool_Implementation');

  // await deploy('CharityPoolCloneFactory', {
  //   contract: 'CharityPoolCloneFactory',
  //   from: deployer,
  //       args: [charityPool.address],
  //   log: true,
  // });


  await deploy('CharityBeaconFactory', {
    contract: 'CharityBeaconFactory',
    from: deployer,
    proxy: {
      owner: proxyAdmin,
      proxyContract: "OpenZeppelinTransparentProxy",
    },
    log: true,
    from: deployer,
    args: [charityPool.address],
    log: true,
  });
};

module.exports.tags = ['FactoryDeployments'];