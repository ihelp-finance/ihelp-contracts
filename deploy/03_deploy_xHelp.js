const { dim, green, chainName, getTokenAddresses, yellow } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const chainId = parseInt(await getChainId(), 10);

  yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow("Protocol Contracts - Deploy Script for xHelp");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  const { deploy, catchUnknownSigner } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  dim(`network: ${chainName(chainId)}`);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  const ihelpToken = await deployments.get('iHelp');

  await catchUnknownSigner(
    deploy("xHelp", {
      contract: 'xHelpToken',
      proxy: {
        owner: proxyAdmin,
        proxyContract: "OpenZeppelinTransparentProxy",
        execute: {
          init: {
            methodName: "initialize",
            args: [
              'xHelp Staking Token',
              'xHELP',
              ihelpToken.address // use dai for underlying
            ]
          }
        }
      },
      log: true,
      from: deployer,
    }));

  yellow(`--- Initialized xHelp Token ---`);

  const xhelpResult = await deployments.get('xHelp');
  const xhelpAddress = xhelpResult.address;

  green('xHelp Proxy:', xhelpAddress);
  green('xHelp Implementation:', xhelpResult.implementation);
};

module.exports.tags = ['xHelp'];
module.exports.dependecies = ["iHelp"];