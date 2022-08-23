const { dim, chainName, yellow, green, saveConnector } = require("../scripts/deployUtils");

module.exports = async({ getNamedAccounts, deployments, getChainId }) => {
  const chainId = parseInt(await getChainId(), 10);

  const { deploy, catchUnknownSigner } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  dim("Protocol Contracts - Deploy TraderJoe Connector");
  dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network:  ${chainName(chainId)} `);
  dim(`deployer: ${deployer}`);
  dim(`chainId:  ${chainId}`);

  await catchUnknownSigner(
    deploy('TraderJoeConnector', {
      contract: 'TraderJoeConnector',
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

  yellow(`\n--- Initialized TraderJoeConnector Contract ---\n`);

  const result = await deployments.get('TraderJoeConnector');
  const address = result.address;

  green('TraderJoeConnector Proxy:', address);
  green('TraderJoeConnector Implementation:', result.implementation);

  await saveConnector('traderjoe', address, process.env.NETWORK_ADDRESSES || chainName(chainId));
};

module.exports.tags = ['connectors', 'TraderJoeConnector'];