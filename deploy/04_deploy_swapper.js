const { dim, green, getSwapAddresses, chainName, yellow } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const chainId = parseInt(await getChainId(), 10);

  yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  yellow("Protocol Contracts - Deploy Script for Swapper");
  yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");


  const { deploy, catchUnknownSigner } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  dim(`network: ${chainName(chainId)}`);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  const swapperAddresses = await getSwapAddresses('uniswap', chainId);

  // deploy the iHelp token
  await catchUnknownSigner(
    deploy("swapper", {
      contract: 'Swapper',
      proxy: {
        proxyContract: "OpenZeppelinTransparentProxy",
        owner: proxyAdmin,
        execute: {
          init: {
            methodName: "initialize",
            args: [swapperAddresses['router']]
          }
        }
      },
      from: deployer,
    })
  );

  yellow(`--- Initialized Swapper Contract ---`);

  const swapperResult = await deployments.get('swapper');
  const swapperAddress = swapperResult.address;

  green('swapper Proxy:', swapperAddress);
  green('swapper Router:', swapperAddresses['router']);
  green('swapper Implementation:', swapperResult.implementation);
};

module.exports.tags = ['swapper'];