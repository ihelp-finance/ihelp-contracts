const { dim, chainName, yellow, green, saveConnector } = require("../scripts/deployUtils");

module.exports = async({ getNamedAccounts, deployments, getChainId }) => {
  const chainId = parseInt(await getChainId(), 10);

  const { deploy, catchUnknownSigner } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  dim("Protocol Contracts - Deploy Compound Connector");
  dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network: ${chainName(chainId)} `);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  await catchUnknownSigner(
    deploy('CompoundConnector', {
      contract: 'CompoundConnector',
      from: deployer,
      log: true,
      proxy: {
        proxyContract: "OpenZeppelinTransparentProxy",
        owner: proxyAdmin,
        execute: {
          init: {
            methodName: "initialize",
            args: []
          }
        }
      },
    }), { log: true }
  );

  yellow(`\n--- Initialized CompoundConnector Contract ---\n`);

  const result = await deployments.get('CompoundConnector');
  const address = result.address;

  green('CompoundConnector Proxy:', address);
  green('CompoundConnector Implementation:', result.implementation);

  await saveConnector('compound', address, chainName(chainId));
};

module.exports.tags = ['connectors', 'CompoundConnector'];