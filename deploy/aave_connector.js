const { dim, chainName, yellow, green, saveConnector } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments, getChainId, }) => {
  const chainId = parseInt(await getChainId(), 10);

  const { deploy, catchUnknownSigner } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  dim("Protocol Contracts - Deploy AAVE Connector");
  dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network: ${chainName(chainId)} `);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  await catchUnknownSigner(
    deploy('AAVEConnector', {
      contract: 'AAVEConnector',
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

  yellow(`\n--- Initialized AAVEConnector Contract ---\n`);

  const result = await deployments.get('AAVEConnector');
  const address = result.address;

  green('AAVEConnector Proxy:', address);
  green('AAVEConnector Implementation:', result.implementation);

  await saveConnector('aave', address, process.env.NETWORK_ADDRESSES || chainName(chainId));

};

module.exports.tags = ['connectors', 'AAVEConnector'];