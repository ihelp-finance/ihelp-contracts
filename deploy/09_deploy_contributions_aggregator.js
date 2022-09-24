const chalk = require('chalk');
const { getChainId } = require('hardhat');
const { chainName, dim, yellow, green } = require("../scripts/deployUtils");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const chainId = parseInt(await getChainId(), 10);

  const { deploy, catchUnknownSigner } = deployments;
  const { deployer, proxyAdmin } = await getNamedAccounts();

  const ihelpToken = await deployments.get('iHelp');
  dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  dim("Protocol Contracts - Deploy Script for ContributionsAggregator");
  dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network: ${chainName(chainId)} `);
  dim(`deployer: ${deployer}`);
  dim(`chainId: ${chainId}`);

  // Deploy the swapper utils library
  const SwapperUtils = await deploy("SwapperUtils", {
    from: deployer
  });

  const iHelp = await deployments.get('iHelp');
  const swapper = await deployments.get('swapper');

  let newlyDeployed;
  await catchUnknownSigner(async () => {
    let result = await deploy('ContributionsAggregator', {
      contract: 'ContributionsAggregator',
      from: deployer,
      log: true,
      libraries: {
        SwapperUtils: SwapperUtils.address,
      },
      proxy: {
        proxyContract: "OpenZeppelinTransparentProxy",
        owner: proxyAdmin,
        execute: {
          init: {
            methodName: "initialize",
            args: [iHelp.address, swapper.address]
          }
        }
      },
    }, { log: true })
    newlyDeployed = result.newlyDeployed;
    return result;
  })


  yellow(`--- Initialized ContributionsAggregator Contract ---`);

  const ContributionsAggregatorResult = await deployments.get('ContributionsAggregator');
  const ContributionsAggregatorAddress = ContributionsAggregatorResult.address;

  green('ContributionsAggregator Proxy:', ContributionsAggregatorAddress);
  green('ContributionsAggregator Implementation:', ContributionsAggregatorResult.implementation);

  const signer = await ethers.getSigner(deployer);
  
  const iHelpInstance = await ethers.getContractAt('iHelpToken', iHelp.address, signer);
  const owner = await iHelpInstance.owner();

  if (!newlyDeployed) {
    return;
  }

  if (owner === deployer) {
    console.log(chalk.yellow(`${chalk.gray(`iHelp contributions aggregator...`)} (${ContributionsAggregatorAddress})`));
    await iHelpInstance.setContributionsAggregator(ContributionsAggregatorAddress);
    console.log(chalk.yellow(`${chalk.gray(`iHelp contributions aggregator... Success`)}`));

  }
  else {
    const { data } = await iHelpInstance.populateTransaction.setContributionsAggregator(ContributionsAggregatorAddress);
    console.log(chalk.gray(`\nAccount ${chalk.yellow(deployer)} does not have permission to execute the update. \nBroadcast the following tx from ${chalk.yellow(owner)} to execute the update :

          ${chalk.yellow(`${data}`)}
      `));
  }
};


module.exports.tags = ['ContributionsAggregatorDeployment'];
module.exports.dependencies = ["iHelpDeployment", "swapper"];