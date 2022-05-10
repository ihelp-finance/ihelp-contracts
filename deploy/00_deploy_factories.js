module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy('CharityPoolCloneFactory', {
    contract: 'CharityPoolCloneFactory',
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports.tags = ['FactoryDeployments'];