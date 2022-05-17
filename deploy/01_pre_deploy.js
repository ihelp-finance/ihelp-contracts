const { dim, fromBigNumber, chainName, cyan } = require("../scripts/deployUtils");
const fs = require("fs");
const { run } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments, getChainId, ethers, upgrades }) => {
  const { deploy } = deployments;
  let {
    deployer,
    stakingPool,
    developmentPool,
    holdingPool,
    proxyAdmin
  } = await getNamedAccounts();

  console.log('');

  const chainId = parseInt(await getChainId(), 10);

  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;

  console.log(chainId);

  const deployMockTokens = true;
  const skipIfAlreadyDeployed = true; //isTestEnvironment == true ? false : true;

  const signer = await ethers.provider.getSigner(deployer);

  console.log(`signer: ${signer._address}`);

  // get the signer eth balance
  const balance = await ethers.provider.getBalance(signer._address);
  console.log(`signer balance: ${fromBigNumber(balance)}`);

  let daiResult = null;
  let cDaiResult = null;
  let usdcResult = null;
  let cUsdcResult = null;
  let cEthResult = null;
  let wethResult = null;

  if (isTestEnvironment && deployMockTokens) {
    dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    dim("Protocol Contracts - Deploy Script For Mocks");
    dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

    dim(`network: ${chainName(chainId)} `);
    dim(`deployer: ${deployer}`);
    dim(`chainId: ${chainId}`);

    cyan("\nDeploying DAI...");
    daiResult = await deploy("DAI", {
      args: [
        'DAI Test Token',
        'DAI',
        18
      ],
      contract: 'ERC20MintableMock',
      from: deployer,
      skipIfAlreadyDeployed: true
    });

    cyan("\nDeploying cDAI...");
    // should be about 20% APR
    let supplyRate = '8888888888888';
    cDaiResult = await deploy("cDAI", {
      args: [
        daiResult.address,
        supplyRate
      ],
      contract: 'CTokenMock',
      from: deployer,
      skipIfAlreadyDeployed: true
    });

    cyan("\nDeploying USDC...");
    usdcResult = await deploy("USDC", {
      args: [
        'USDC Test Token',
        'USDC',
        6
      ],
      contract: 'ERC20MintableMock',
      from: deployer,
    });

    cyan("\nDeploying cUSDC...");
    // should be about 20% APR
    cUsdcResult = await deploy("cUSDC", {
      args: [
        usdcResult.address,
        supplyRate
      ],
      contract: 'CTokenMock',
      from: deployer,
    });

    // cyan("\nDeploying WETH...")
    // wethResult = await deploy("WETH", {
    //   args: [
    //     'WETH Test Token',
    //     'WETH',
    //     18
    //   ],
    //   contract: 'ERC20Mintable',
    //   from: deployer,
    //   skipIfAlreadyDeployed: true
    // })

    // cyan("\nDeploying cETH...")
    // // should be about 20% APR
    // cEthResult = await deploy("cETH", {
    //   args: [
    //     supplyRate
    //   ],
    //   contract: 'CEtherMock',
    //   from: deployer,
    //   skipIfAlreadyDeployed: true
    // })

    // Display Contract Addresses
    dim("\nLocal Contract Deployments;\n");
    dim("  - DAI:               ", daiResult.address);
    dim("  - cDAI:              ", cDaiResult.address);
    dim("  - USDC:              ", usdcResult.address);
    dim("  - cUSDC:             ", cUsdcResult.address);
    //dim("  - WETH:              ", wethResult.address)
    //dim("  - cETH:              ", cEthAddress)
  }

  // publish the contracts
  const exec = require('child_process').exec;

  function os_func() {
    this.execCommand = function (cmd) {
      return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(stdout);
        });
      });
    };
  }
  var os = new os_func();

  //cyan('hardhat export --export-all ../react-app/src/contracts/hardhat_contracts.json');
  //await os.execCommand('hardhat export --export-all ../react-app/src/contracts/hardhat_contracts.json');


  cyan('hardhat export --export-all ./build/hardhat_contracts.json');
  return await run('export', { "exportAll": "./build/hardhat_contracts.json" });

};

module.exports.tags = ['Mocks'];