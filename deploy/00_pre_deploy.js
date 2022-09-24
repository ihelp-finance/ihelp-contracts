const { dim, fromBigNumber, chainName, cyan } = require("../scripts/deployUtils");
const fs = require("fs");
const { run } = require("hardhat");

module.exports = async({ getNamedAccounts, deployments, getChainId, ethers, upgrades }) => {
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
  const deployMockTokens = process.env.REACT_APP_TEST_TOKENS || 'true';
  const skipIfAlreadyDeployed = true; //isTestEnvironment == true ? false : true;

  const signer = await ethers.provider.getSigner(deployer);

  console.log(`signer: ${signer._address}`);

  // get the signer eth balance
  const balance = await ethers.provider.getBalance(signer._address);
  console.log(`signer balance: ${fromBigNumber(balance)}`);

  if (isTestEnvironment && deployMockTokens == 'true') {

    dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    dim("Protocol Contracts - Deploy Script For Mocks");
    dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

    let mockCurrenciesToDeploy = [{
        currency: 'jDAI.e',
        decimals: 18,
        contract: 'ERC20MintableMock'
      },
      {
        currency: 'jUSDC',
        decimals: 6,
        contract: 'ERC20MintableMock'
      },
      {
        currency: 'jWAVAX',
        decimals: 18,
        contract: 'WTokenMock'
      }
    ];

    dim(`currencies: ${mockCurrenciesToDeploy.map((c)=>{return c['currency']})}`);
    dim(`network: ${chainName(chainId)}`);
    dim(`deployer: ${deployer}`);
    dim(`chainId: ${chainId}\n`);

    const currencyResults = [];
    for (let ci = 0; ci < mockCurrenciesToDeploy.length; ci++) {

      const c = mockCurrenciesToDeploy[ci];

      let result = await deployments.getOrNull(c['currency'].replace('j','').replace('c','').replace('a',''));
      if (result == null) {

        cyan(`Deploying ${c['currency'].replace('j','').replace('c','').replace('a','')}...`);

        let args = null;
        if (c['contract'] != 'WTokenMock') {
          args = [
            `${c['currency'].replace('j','').replace('c','').replace('a','')} Test Token`,
            c['currency'].replace('j','').replace('c','').replace('a',''),
            c['decimals']
          ];
        }
        else {
          args = [];
        }

        result = await deploy(c['currency'].replace('j','').replace('c','').replace('a',''), {
          args: args,
          contract: c['contract'],
          from: deployer,
          skipIfAlreadyDeployed: true
        });

      }

      let cresult = await deployments.getOrNull(`${c['currency']}`);
      if (cresult == null) {

        cyan(`Deploying ${c['currency']}...`);
        // should be about 20% APR
        let supplyRate = '25367833587011';
        cresult = await deploy(`${c['currency']}`, {
          args: [
            result.address,
            supplyRate
          ],
          contract: 'CTokenMock',
          from: deployer,
          skipIfAlreadyDeployed: true
        });

      }

      currencyResults.push(`  - ${c['currency'].replace('j','').replace('c','').replace('a','')}: ${result.address}`);
      currencyResults.push(`  - ${c['currency']}: ${cresult.address}`);

    }

    // Display Contract Addresses
    dim("\nLocal Contract Deployments;\n");
    await currencyResults.map((r) => {
      dim(r);
    })
    
    // publish the contracts
    const exec = require('child_process').exec;
  
    function os_func() {
      this.execCommand = function(cmd) {
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
    cyan('hardhat export --export-all ./build/hardhat_contracts.json');
    try {
      return await run('export', { "exportAll": "./build/hardhat_contracts.json" });
    }
    catch (e) {}

  }

};

module.exports.tags = ['Mocks'];