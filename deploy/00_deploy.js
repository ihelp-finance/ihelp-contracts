const ethersLib = require('ethers')
const chalk = require('chalk')
const Big = require('big.js');
const Web3 = require('web3');
const fs = require('fs');
const web3 = new Web3('http://127.0.0.1:7545');

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: 'contractAddresses.csv',
  header: [
    { id: 'name', title: 'Contract' },
    { id: 'address', title: 'Address' },
  ],
  append: false
});

const externalContracts = require('../../react-app/src/contracts/external_contracts');

const fromBigNumber = (number, decimals) => {
  if (decimals == undefined) {
    return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)))
  }
  else {
    return parseFloat(ethersLib.utils.formatUnits(number, decimals));
  }
}

function dim() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.dim.call(chalk, ...arguments))
  }
}

function cyan() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.cyan.call(chalk, ...arguments))
  }
}

function yellow() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.yellow.call(chalk, ...arguments))
  }
}

function green() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.green.call(chalk, ...arguments))
  }
}

function displayResult(name, result) {
  if (!result.newlyDeployed) {
    yellow(`Re-used existing ${name} at ${result.address}`)
  }
  else {
    green(`${name} deployed at ${result.address}`)
  }
}

const chainName = (chainId) => {
  switch (chainId) {
    case 1:
      return 'Mainnet';
    case 3:
      return 'Ropsten';
    case 4:
      return 'Rinkeby';
    case 5:
      return 'Goerli';
    case 42:
      return 'Kovan';
    case 56:
      return 'Binance Smart Chain';
    case 77:
      return 'POA Sokol';
    case 97:
      return 'Binance Smart Chain (testnet)';
    case 99:
      return 'POA';
    case 100:
      return 'xDai';
    case 137:
      return 'Matic';
    case 31337:
      return 'localhost';
    case 43113:
      return 'Fuji';
    case 43114:
      return 'Avalanche';
    case 80001:
      return 'Matic (Mumbai)';
    default:
      return 'Unknown';
  }
}

module.exports = async({ getNamedAccounts, deployments, getChainId, ethers, upgrades }) => {

  const { deploy } = deployments;
  let {
    deployer,
    stakingPool,
    developmentPool,
    holdingPool
  } = await getNamedAccounts();

  console.log('');
  
  const chainId = parseInt(await getChainId(), 10)

  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;

  const deployMockTokens = true;
  const skipIfAlreadyDeployed = true; //isTestEnvironment == true ? false : true;

  const signer = await ethers.provider.getSigner(deployer);
  
  console.log(`signer: ${signer._address}`);

  // get the signer eth balance
  const balance = await ethers.provider.getBalance(signer._address);
  console.log(`signer balance: ${fromBigNumber(balance)}`);


  dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
  dim("Protocol Contracts - Deploy Script")
  dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")

  dim(`network: ${chainName(chainId)} (${isTestEnvironment ? 'local' : 'remote'})`)
  dim(`deployer: ${deployer}`)
  dim(`chainId: ${chainId}`)

  let daiResult = null;
  let cDaiResult = null;
  let usdcResult = null;
  let cUsdcResult = null;
  let cEthResult = null;
  let wethResult = null;

  if (isTestEnvironment && deployMockTokens) {

    cyan("\nDeploying DAI...")
    daiResult = await deploy("DAI", {
      args: [
        'DAI Test Token',
        'DAI',
        18
      ],
      contract: 'ERC20Mintable',
      from: deployer,
      skipIfAlreadyDeployed: true
    })

    cyan("\nDeploying cDAI...")
    // should be about 20% APR
    let supplyRate = '8888888888888'
    cDaiResult = await deploy("cDAI", {
      args: [
        daiResult.address,
        supplyRate
      ],
      contract: 'CTokenMock',
      from: deployer,
      skipIfAlreadyDeployed: true
    })

    cyan("\nDeploying USDC...")
    usdcResult = await deploy("USDC", {
      args: [
        'USDC Test Token',
        'USDC',
        6
      ],
      contract: 'ERC20Mintable',
      from: deployer,
      skipIfAlreadyDeployed: true
    })

    cyan("\nDeploying cUSDC...")
    // should be about 20% APR
    cUsdcResult = await deploy("cUSDC", {
      args: [
        usdcResult.address,
        supplyRate
      ],
      contract: 'CTokenMock',
      from: deployer,
      skipIfAlreadyDeployed: true
    })

    cyan("\nDeploying WETH...")
    wethResult = await deploy("WETH", {
      args: [
        'WETH Test Token',
        'WETH',
        18
      ],
      contract: 'ERC20Mintable',
      from: deployer,
      skipIfAlreadyDeployed: true
    })

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
    dim("\nLocal Contract Deployments;\n")
    dim("  - DAI:              ", daiResult.address)
    dim("  - cDAI:              ", cDaiResult.address)
    dim("  - USDC:              ", usdcResult.address)
    dim("  - cUSDC:              ", cUsdcResult.address)
    dim("  - WETH:              ", wethResult.address)
    //dim("  - cETH:              ", cEthAddress)

  }
  console.log('');

  // deploy the iHelp token

  const getTokenAddresses = async(currency, lender) => {

    let ctokenaddress = null;
    let pricefeed = null;
    let tokenaddress = null;

    let addresses = fs.readFileSync(`./networks/${chainName(chainId)}-lending.json`,'utf8');
    addresses = JSON.parse(addresses);

    if (isTestEnvironment && deployMockTokens) {

      if (currency == 'DAI') {
        tokenaddress = daiResult.address;
        ctokenaddress = cDaiResult.address;
        pricefeed = addresses[lender]['PriceOracleProxy']['DAI'];
      }
      else if (currency == 'USDC') {
        tokenaddress = usdcResult.address;
        ctokenaddress = cUsdcResult.address;
        pricefeed = addresses[lender]['PriceOracleProxy']['USDC'];
      }
      else if (currency == 'WETH') {
        tokenaddress = wethResult.address;
        ctokenaddress = null;
        pricefeed = addresses[lender]['PriceOracleProxy']['WETH'];
      }
      else if (currency == 'HELP') {
        tokenaddress = ihelpResult.address;
        ctokenaddress = null;
        pricefeed = null;
      }

    }
    else {

      if (currency == 'DAI') {
        tokenaddress = addresses[lender]['Tokens']['DAI'];
        ctokenaddress = addresses[lender]['lendingTokens']['DAI'];
        pricefeed = addresses[lender]['PriceOracleProxy']['DAI'];
      }
      else if (currency == 'USDC') {
        tokenaddress = addresses[lender]['Tokens']['USDC'];
        ctokenaddress = addresses[lender]['lendingTokens']['USDC'];
        pricefeed = addresses[lender]['PriceOracleProxy']['USDC'];
      }
      else if (currency == 'USDT') {
        tokenaddress = addresses[lender]['Tokens']['USDT'];
        ctokenaddress = addresses[lender]['lendingTokens']['USDT'];
        pricefeed = addresses[lender]['PriceOracleProxy']['USDT'];
      }
      else if (currency == 'HELP') {
        tokenaddress = ihelpResult.address;
        ctokenaddress = null;
        pricefeed = null;
      }

    }

    return {
      "token": tokenaddress,
      "lendingtoken": ctokenaddress,
      "pricefeed": pricefeed
    };

  }

  const ihelpAddresses = await getTokenAddresses('DAI', 'compound');

  const holdingtokenAddress = ihelpAddresses['token'];
  
  const ihelpResult = await deploy("iHelp", {
    contract: 'iHelpToken',
    proxy: {
      from: deployer,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        init: {
          methodName: "initialize",
          args: ['iHelp Token',
            'HELP',
            signer._address, // operator
            stakingPool, // 15% of interest
            developmentPool, // 5% of interest
            holdingPool, // 20% of interest
            holdingtokenAddress, // underlying dai token for ihelp transfer
          ]
        },
        onUpgrade: {
          methodName: "postUpgrade",
          args: []
        }
      }
    },
    log: true,
    from: deployer,
    skipIfAlreadyDeployed: skipIfAlreadyDeployed
  });
  if (ihelpResult.newlyDeployed) {
    green(`--- Initialized iHelp Token ---`);
  }
  const ihelpAddress = ihelpResult.address;
  
  green('iHelp Proxy:',ihelpAddress)
  green('iHelp Implementation:',ihelpResult.implementation)
  //console.dir(ihelpResult)

  let ihelp = await ethers.getContractAt('iHelpToken', ihelpAddress);

  // let currentSupply = await ihelp.totalSupply();
  // if (currentSupply.toString() == '0') {
  //   console.log('minting initial HELP tokens')
  //   await ihelp.mint(signer._address, ethers.utils.parseEther('1000000'))
  // }

  // deploy the xHelp token
  const xhelpResult = await deploy("xHelp", {
    contract: 'xHelpToken',
    proxy: {
      from: deployer,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [
            'xHelp Staking Token',
            'xHELP',
            ihelpAddress // use dai for underlying
          ]
        }
      }
    },
    log: true,
    from: deployer,
    skipIfAlreadyDeployed: skipIfAlreadyDeployed
  });
  if (xhelpResult.newlyDeployed) {
    green(`--- Initialized xHelp Token ---`);
  }
  const xhelpAddress = xhelpResult.address;

  const getSwapAddresses = async(dex) => {

    let addresses = fs.readFileSync(`./networks/${chainName(chainId)}-dex.json`);
    addresses = JSON.parse(addresses);

    return addresses[dex];

  }

  const swapperAddresses = await getSwapAddresses('uniswap');

  // deploy the iHelp token
  const swapperResult = await deploy("swapper", {
    contract: 'Swapper',
    proxy: {
      from: deployer,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [swapperAddresses['router']]
        }
      }
    },
    from: deployer,
    skipIfAlreadyDeployed: skipIfAlreadyDeployed
  });
  if (swapperResult.newlyDeployed) {
    green(`--- Initialized Swapper Contract ---`);
  }
  const swapperAddress = swapperResult.address;


  // if using mock tokens, create the uniswap pair liquidity pool

  const IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json");
  const IUniswapV2Pair = require("@uniswap/v2-core/build/IUniswapV2Pair.json");
  const IUniswapV2Router02 = require("@uniswap/v2-periphery/build/IUniswapV2Router02.json");

  const swapv2FactoryAddress = swapperAddresses['factory'];
  const swapv2RouterAddress = swapperAddresses['router'];

  console.log('router',swapv2RouterAddress);
  console.log('factory',swapv2FactoryAddress);

  //const mainnetInfura = new ethers.providers.StaticJsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
  const mainnetInfura = new ethers.providers.StaticJsonRpcProvider("https://eth-rinkeby.alchemyapi.io/v2/UipRFhJQbBiZ5j7lbcWt46ex5CBjVBpW");
  const swapv2Factory = new ethers.Contract(swapv2FactoryAddress, IUniswapV2Factory['abi'], mainnetInfura);
  const swapv2Router = new ethers.Contract(swapv2RouterAddress, IUniswapV2Router02['abi'], mainnetInfura);

  const userSigner = await ethers.provider.getSigner(stakingPool);
  const userAccount = stakingPool;

  // activate the LP 

  const activateLiquidityPool = async(token1, token2, token1value, token2value, lender, dex) => {

    const token1Addresses = await getTokenAddresses(token1, lender);
    const token2Addresses = await getTokenAddresses(token2, lender);

    const token1Address = token1Addresses['token'];
    const token2Address = token2Addresses['token'];

    console.log('');
    dim(token1, '->', token2);
    dim(token1Address, '->', token2Address);

    let token1contract;
    if (token1 == 'HELP') {
      token1contract = await ethers.getContractAt('iHelpToken', token1Address, signer);
    }
    else {
      token1contract = await ethers.getContractAt('ERC20Mintable', token1Address, signer);
    }
    const token2contract = await ethers.getContractAt('ERC20Mintable', token2Address, signer);

    const token1decimals = await token1contract.decimals();
    const token2decimals = await token2contract.decimals();

    //console.log(token1value,token2value)
    //console.log(token1decimals,token2decimals)

    let getPair1 = await swapv2Factory.connect(userSigner).getPair(token1Address, token2Address);
    dim('   pair', getPair1);

    try {
      const createPairTx = await swapv2Factory.connect(signer).createPair(token1Address, token2Address);
      await createPairTx.wait();
      dim('   pair created');
      getPair1 = await swapv2Factory.connect(userSigner).getPair(token1Address, token2Address);
      dim('   new pair', getPair1);
    }
    catch (e) {}

    const swapv2Pair1 = new ethers.Contract(getPair1, IUniswapV2Pair['abi'], mainnetInfura);

    let pairSupply1 = 0;
    try {
      pairSupply1 = await swapv2Pair1.connect(userSigner).totalSupply();
      pairSupply1 = fromBigNumber(pairSupply1, token2decimals - token1decimals > 0 ? token2decimals - token1decimals : token2decimals);
    }
    catch (e) {}
    dim('   pairSupply', pairSupply1);

    if (pairSupply1 == 0) {

      const currentBalance1 = await token1contract.balanceOf(userAccount);

      if (fromBigNumber(currentBalance1, token1decimals) < parseFloat(token1value) || fromBigNumber(currentBalance1, token1decimals) == 0) {
        if (token1 == 'HELP') {
          console.log('minting help tokens...');
          const MintTx1 = await token1contract.mint(userAccount, ethers.utils.parseUnits(token1value, token1decimals));
          await MintTx1.wait();
        }
        else {
          console.log('minting token1...');
          const MintTx1 = await token1contract.allocateTo(userAccount, ethers.utils.parseUnits(token1value, token1decimals));
          await MintTx1.wait();
        }
      }

      const currentBalance2 = await token2contract.balanceOf(userAccount);
      if (fromBigNumber(currentBalance2, token2decimals) < parseFloat(token2value) || fromBigNumber(currentBalance2, token2decimals) == 0) {
        console.log('minting token2...')
        const MintTx2 = await token2contract.allocateTo(userAccount, ethers.utils.parseUnits(token2value, token2decimals));
        await MintTx2.wait();
      }

      // add liquidity to the pair
      let devTx1Approve = await token1contract.connect(userSigner).approve(swapv2RouterAddress, ethers.utils.parseUnits(token1value, token1decimals));
      //console.log(devTx1Approve['hash']);
      await devTx1Approve.wait();

      let devTx2Approve = await token2contract.connect(userSigner).approve(swapv2RouterAddress, ethers.utils.parseUnits(token2value, token2decimals));
      //console.log(devTx2Approve['hash']);
      await devTx2Approve.wait();

      const addLiquid = await swapv2Router.connect(userSigner).addLiquidity(token1Address, token2Address, ethers.utils.parseUnits(token1value, token1decimals), ethers.utils.parseUnits(token2value, token2decimals), ethers.utils.parseUnits(token1value, token1decimals), ethers.utils.parseUnits(token2value, token2decimals), userAccount, Math.floor(Date.now() / 1000) + 300);
      await addLiquid.wait();

      let pairSupply1 = 0;
      try {
        pairSupply1 = await swapv2Pair1.connect(userSigner).totalSupply();
        pairSupply1 = fromBigNumber(pairSupply1, token2decimals - token1decimals > 0 ? token2decimals - token1decimals : token2decimals);
      }
      catch (e) {}
      dim('   new pairSupply', pairSupply1);

    }

  }

  // await activateLiquidityPool('HELP', 'DAI', '125000', '150000', 'aave', 'traderjoe');

  if (isTestEnvironment && deployMockTokens) {
    
    yellow('\nActivating liquidity pools for test environment...');

    await activateLiquidityPool('USDC', 'DAI', '50000000', '50000000', 'compound', 'uniswap');
    // await activateLiquidityPool('WETH', 'DAI', '3500', '50000000', 'compound', 'uniswap');

  }
  
  console.log('');
  green('Signer Address:', signer._address);
  // green('DAI Address:', daiAddress);
  // green('cDAI Address:', cDaiAddress);
  // green('USDC Address:', usdcAddress);
  // green('cUSDC Address:', cUsdcAddress);
  // green('WETH Address:', wethAddress);
  // green('cETH Address:', cEthAddress);
  green('iHelp Address:', ihelpAddress);
  green('xHelp Address:', xhelpAddress);
  green('Swapper Address:', swapperAddress);
  // green('CharityPool 1 Address:', charity1Address);
  // green('CharityPool 2 Address:', charity2Address);
  // green('CharityPool 3 Address:', charity3Address);
  // green('CharityPool 4 Address:', charity4Address);
  green('Development Pool Address:', developmentPool);
  green('Staking Pool Address:', stakingPool);
  green('Holding Pool Address:', holdingPool);
  green('');

  const contractAddresses = [
    { name: 'Signer', address: signer._address },
    { name: 'iHelp', address: ihelpAddress },
    { name: 'xHelp', address: xhelpAddress },
    { name: 'Swapper', address: swapperAddress },
    { name: 'Development Pool', address: developmentPool },
    { name: 'Staking Pool', address: stakingPool },
    { name: 'Holding Pool', address: holdingPool },
  ]

  // publish the contracts
  const exec = require('child_process').exec;
  function os_func() {
      this.execCommand = function (cmd) {
          return new Promise((resolve, reject)=> {
             exec(cmd, (error, stdout, stderr) => {
               if (error) {
                  reject(error);
                  return;
              }
              resolve(stdout)
             });
         })
     }
  }
  var os = new os_func();

  cyan('hardhat export --export-all ../react-app/src/contracts/hardhat_contracts.json');
  await os.execCommand('hardhat export --export-all ../react-app/src/contracts/hardhat_contracts.json');
  
  // write the key addresses to a csv file
  return csvWriter.writeRecords(contractAddresses).then(() => {})

};
module.exports.tags = ["iHelpDeployment"];
