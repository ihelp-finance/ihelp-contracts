const { chainName, dim, yellow } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const chainId = parseInt(await getChainId(), 10);

  const { deploy, execute, catchUnknownSigner, read } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow("Protocol Contracts - Deploy Script for Charity Pool Factories");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network: ${chainName(chainId)} `);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  await deploy('CharityPool_Implementation', {
    contract: 'CharityPool',
    from: deployer,
    skipIfAlreadyDeployed: true,
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

  await catchUnknownSigner(
    deploy('CharityBeaconFactory', {
      from: deployer,
      skipIfAlreadyDeployed: true,
      proxy: {
        owner: proxyAdmin,
        proxyContract: "OpenZeppelinTransparentProxy",
        execute: {
          init: {
            methodName: "initialize",
            args: [charityPool.address]
          }
        }
      },
      log: true,
    })
  );

  const owner = await read('CharityBeaconFactory', { from: deployer, log: true }, 'owner');
  if (owner !== proxyAdmin && proxyAdmin != undefined) {
    // Transfer the ownership to the proxy admin  is not in test mode
    await execute('CharityBeaconFactory', { from: deployer, log: true }, 'transferOwnership', proxyAdmin);
  }
};

module.exports.tags = ['FactoryDeployments'];