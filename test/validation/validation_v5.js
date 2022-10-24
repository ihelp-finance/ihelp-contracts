const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:8545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk');
const ethers = require('ethers');
var path = require('path');

const { assert, use, expect } = require("chai");

let userSigner1, userSigner2, signer;

const fromBigNumber = (number, decimals) => {
  if (decimals == undefined) {
    return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)));
  } else {
    return parseFloat(ethers.utils.formatUnits(number, decimals));
  }
};


function dim() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.dim.call(chalk, ...arguments));
  }
}

function cyan() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.cyan.call(chalk, ...arguments));
  }
}

function yellow() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.yellow.call(chalk, ...arguments));
  }
}

function green() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.green.call(chalk, ...arguments));
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
      return 'HardhatEVM';
    case 80001:
      return 'Matic (Mumbai)';
    default:
      return 'Unknown';
  }
};

const validate = async () => {

  const { deploy } = hardhat.deployments;

  let {
    deployer,
    stakingPool,
    developmentPool,
    holdingPool,
    charity1wallet,
    charity2wallet,
    charity3wallet,
    userAccount1,
    userAccount2,
  } = await hardhat.getNamedAccounts();

  console.log(`user1:`, userAccount1);
  console.log(`user2:`, userAccount2);

  userSigner1 = hardhat.ethers.provider.getSigner(userAccount1);
  userSigner2 = hardhat.ethers.provider.getSigner(userAccount2);

  signer = hardhat.ethers.provider.getSigner(deployer);

  // get the signer eth balance
  const balance = await hardhat.ethers.provider.getBalance(signer._address);
  console.log(`signer balance: ${fromBigNumber(balance)}`);

  const chainId = 31337;

  const isTestEnvironment = chainId === 31337 || chainId === 1337;
  const deployMockTokens = true;

  const charity1walletSigner = hardhat.ethers.provider.getSigner(charity1wallet);
  const charity2walletSigner = hardhat.ethers.provider.getSigner(charity2wallet);
  const charity3walletSigner = hardhat.ethers.provider.getSigner(charity3wallet);
  const stakingPoolSigner = hardhat.ethers.provider.getSigner(stakingPool);

  console.log(`signer: ${signer._address}`);

  // get the signer eth balance
  //const balance = await hardhat.ethers.provider.getBalance(signer._address);
  //console.log(`signer balance: ${fromBigNumber(balance)}`);

  // get the contracts
  const useMockDai = true;

  yellow('\nSTARTING VALIDATION...\n');

  const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
  const xhelpAddress = (await hardhat.deployments.get('xHelp')).address;
  const daiAddress = (await hardhat.deployments.get('DAI.e')).address;
  const cDaiAddress = (await hardhat.deployments.get('jDAI.e')).address;
  const usdcAddress = (await hardhat.deployments.get('USDC')).address;
  const cUsdcAddress = (await hardhat.deployments.get('jUSDC')).address;
  const swapperAddress = (await hardhat.deployments.get('swapper')).address;
  const charity1Address = (await hardhat.deployments.get('charityPool1')).address;
  const charity2Address = (await hardhat.deployments.get('charityPool2')).address;
  const charity3Address = (await hardhat.deployments.get('charityPool3')).address;
  const contributionsAggregatorAddress = (await hardhat.deployments.get('ContributionsAggregator')).address;

  green('Signer Address:', signer._address);
  green('DAI Address:', daiAddress);
  green('cDAI Address:', cDaiAddress);
  green('USDC Address:', usdcAddress);
  green('cUSDC Address:', cUsdcAddress);
  green('iHelp Address:', ihelpAddress);
  green('xHelp Address:', xhelpAddress);
  green('Swapper Address:', swapperAddress);
  green('CharityPool 1 Address:', charity1Address);
  green('CharityPool 2 Address:', charity2Address);
  green('CharityPool 3 Address:', charity3Address);
  green('Development Pool Address:', developmentPool);
  green('Contributions Aggregator Address:', contributionsAggregatorAddress);

  green('');

  // get the contracts
  const mockDai = false;

  // get the contracts here
  let ihelp, xhelp, swapper, dai, cdai, usdc, cusdc, charityPool1, charityPool2, charityPool3, contributionsAggregator;
  ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);
  xhelp = await hardhat.ethers.getContractAt('xHelpToken', xhelpAddress, signer);
  dai = await hardhat.ethers.getContractAt('ERC20MintableMock', daiAddress, signer);
  cdai = await hardhat.ethers.getContractAt('CTokenMock', cDaiAddress, signer);
  usdc = await hardhat.ethers.getContractAt('ERC20MintableMock', usdcAddress, signer);
  cusdc = await hardhat.ethers.getContractAt('CTokenMock', cUsdcAddress, signer);
  swapper = await hardhat.ethers.getContractAt('Swapper', swapperAddress, signer);
  contributionsAggregator =  await hardhat.ethers.getContractAt('ContributionsAggregator', contributionsAggregatorAddress, signer);

  yellow("Configurating charity pools...");
  charityPool1 = await hardhat.ethers.getContractAt('CharityPool', charity1Address, signer);
  charityPool2 = await hardhat.ethers.getContractAt('CharityPool', charity2Address, signer);
  charityPool3 = await hardhat.ethers.getContractAt('CharityPool', charity3Address, signer);

  const daiDecimals = await dai.decimals();
  const usdcDecimals = await usdc.decimals();

  // assume this runs from a fresh deployment

  // get the users dai balance
  const currentDaiBalance1 = await dai.balanceOf(userAccount1);
  console.log('current user1 dai:', fromBigNumber(currentDaiBalance1));
  if (fromBigNumber(currentDaiBalance1) == 0) {
    console.log('minting user1 test dai...');
    const daiMintTx = await dai.mint(userAccount1, web3.utils.toWei('18100'));
    await daiMintTx.wait();
    const currentDaiBalance1 = await dai.balanceOf(userAccount1);
    console.log('new user1 dai:', fromBigNumber(currentDaiBalance1));
  }

  const currentUsdcBalance1 = await usdc.balanceOf(userAccount1);
  console.log('current user1 usdc:', fromBigNumber(currentUsdcBalance1, usdcDecimals));
  if (fromBigNumber(currentUsdcBalance1, usdcDecimals) == 0) {
    console.log('minting user1 test usdc...');
    const usdcMintTx = await usdc.mint(userAccount1, ethers.utils.parseUnits('1000', usdcDecimals));
    await usdcMintTx.wait();
    const currentUsdcBalance1 = await usdc.balanceOf(userAccount1);
    console.log('new user1 usdc:', fromBigNumber(currentUsdcBalance1, usdcDecimals));
  }

  const currentDaiBalance2 = await dai.balanceOf(userAccount2);
  console.log('current user2 dai:', fromBigNumber(currentDaiBalance2));
  if (fromBigNumber(currentDaiBalance2) == 0) {
    console.log('minting user2 test dai...');
    const daiMintTx = await dai.mint(userAccount2, web3.utils.toWei('7500'));
    await daiMintTx.wait();
    const currentDaiBalance2 = await dai.balanceOf(userAccount2);
    console.log('new user2 dai:', fromBigNumber(currentDaiBalance2));
  }

  const currentUsdcBalance2 = await usdc.balanceOf(userAccount2);
  console.log('current user2 usdc:', fromBigNumber(currentUsdcBalance2, usdcDecimals));
  if (fromBigNumber(currentUsdcBalance2, usdcDecimals) == 0) {
    console.log('minting user2 test usdc...');
    const usdcMintTx = await usdc.mint(userAccount2, ethers.utils.parseUnits('9000', usdcDecimals));
    await usdcMintTx.wait();
    const currentUsdcBalance2 = await usdc.balanceOf(userAccount2);
    console.log('new user2 usdc:', fromBigNumber(currentUsdcBalance2, usdcDecimals));
  }

  // confirm 1m ihelp tokens in supply
  let currentSupply = await ihelp.totalAvailableSupply();

  console.log('current help:', fromBigNumber(currentSupply));

  //assert(fromBigNumber(currentSupply) >= 1000000, '1m HELP tokens not in supply...');

  // load the outputs

  var csvPath = path.join(__dirname, 'validation_v5.csv');

  const checkBody = fs.readFileSync(csvPath, 'utf8');

  const check = await csv().fromString(checkBody);

  const ERROR_THRESHOLD = 0.05;
  const withinError = (value, actual, test) => {
    let result, error;
    if (actual == 0) {
      if (value == 0) {
        result = true;
      }
      else {
        result = false;
      }
    }
    else {
      error = Math.abs((value - actual) / actual);
      if (error <= ERROR_THRESHOLD) {
        result = true;
      }
      else {
        result = false;
      }
    }
    if (!result) {
      console.log(chalk.red(`Test failed for ${test}, expected ${chalk.green(actual)} got ${chalk.yellow(value)}, error margin ${chalk.yellow((error * 100).toFixed(4))}%`));
      throw new Error('Test failed');
    }
    return result;
  };

  const getOutputs = async (input) => {

    let result = null;
    for (let i = 0; i < check.length; i++) {
      if (check[i]['Input'] == (input).toString()) {
        result = check[i];
        const keys = Object.keys(result);
        for (let j = 0; j < keys.length; j++) {
          if (result[keys[j]] == '') {
            result[keys[j]] = 0;
          }
          else {
            try {
              result[keys[j]] = parseFloat(result[keys[j]].replace(/,/g, ''));
            }
            catch (e) { }
          }
        }
        break;
      }
    }

    const c1contributionsTx = await charityPool1.accountedBalances(cDaiAddress);
    const c1contributions = fromBigNumber(c1contributionsTx, daiDecimals);

    const c2contributionsTx = await charityPool2.accountedBalances(cUsdcAddress);
    const c2contributions = fromBigNumber(c2contributionsTx, usdcDecimals);

    const c3contributionsTx = await charityPool3.accountedBalances(cDaiAddress);
    const c3contributions = fromBigNumber(c3contributionsTx, daiDecimals);

    const phaseTx = await ihelp.tokenPhase();
    const phase = parseInt(Big(phaseTx).toFixed(0));

    const helpsupplyTx = await ihelp.totalAvailableSupply();
    const helpsupply = fromBigNumber(helpsupplyTx);
    const helpcirculatingTx = await ihelp.totalCirculating();
    const helpcirculating = fromBigNumber(helpcirculatingTx);

    const helpunclaimedTx1 = await ihelp.getClaimableTokens(userAccount1);
    const helpunclaimed1 = fromBigNumber(helpunclaimedTx1);
    const helpunclaimedTx2 = await ihelp.getClaimableTokens(userAccount2);
    const helpunclaimed2 = fromBigNumber(helpunclaimedTx2);
    
    const helpunclaimed = helpunclaimed1 + helpunclaimed2;

    const c1interestTx = await charityPool1.totalInterestEarnedUSD();
    const c1interest = fromBigNumber(c1interestTx);

    const c2interestTx = await charityPool2.totalInterestEarnedUSD();
    const c2interest = fromBigNumber(c2interestTx);
    
    const c3interestTx = await charityPool3.totalInterestEarnedUSD();
    const c3interest = fromBigNumber(c3interestTx);

    await charityPool1.claimInterest();
    const c1walletTx = await charityPool1.claimableInterest();
    const c1wallet = fromBigNumber(c1walletTx);

    await charityPool2.claimInterest();
    const c2walletTx = await charityPool2.claimableInterest();
    const c2wallet = fromBigNumber(c2walletTx);

    await charityPool3.claimInterest();
    const c3walletTx = await charityPool3.claimableInterest();
    const c3wallet = fromBigNumber(c3walletTx);

    const devpoolTx = await dai.balanceOf(developmentPool);
    const devpool = fromBigNumber(devpoolTx);

    const stakepoolTx = await xhelp.totalAwarded();
    const stakepool = fromBigNumber(stakepoolTx);

    const user1helpTx = await ihelp.balanceOf(userAccount1);
    const user1help = fromBigNumber(user1helpTx);

    const user2helpTx = await ihelp.balanceOf(userAccount2);
    const user2help = fromBigNumber(user2helpTx);

    const user1xhelpTx = await xhelp.balanceOf(userAccount1);
    const user1xhelp = fromBigNumber(user1xhelpTx);

    const user2xhelpTx = await xhelp.balanceOf(userAccount2);
    const user2xhelp = fromBigNumber(user2xhelpTx);

    // const xhelpratioTx = await xhelp.exchangeRateCurrent();
    // const xhelpratio = fromBigNumber(xhelpratioTx);
    const charitypool = c1wallet + c2wallet + c3wallet;

    const totalinterest = c1interest + c2interest + c3interest;

    const c1contributionsPASS = withinError(parseFloat(c1contributions.toFixed(2)), result['Contribution Balance C1 DAI'], 'Contribution Balance C1 DAI') ? chalk.green('PASS') : chalk.red('FAIL');;
    const c2contributionsPASS = withinError(parseFloat(c2contributions.toFixed(2)), result['Contribution Balance C2 USDC'], 'Contribution Balance C2 USDC') ? chalk.green('PASS') : chalk.red('FAIL');;
    const c3contributionsPASS = withinError(parseFloat(c3contributions.toFixed(2)), result['Contribution Balance C3 DAI'], 'Contribution Balance C3 DAI') ? chalk.green('PASS') : chalk.red('FAIL');;
    const phasePASS = withinError(phase, result['Phase'], 'Phase') ? chalk.green('PASS') : chalk.red('FAIL');;
    const helpsupplyPASS = withinError(parseFloat(helpsupply.toFixed(2)), result['Total HELP Supply'], 'Total HELP Supply') ? chalk.green('PASS') : chalk.red('FAIL');;
    const helpcirculatingPASS = withinError(parseFloat(helpcirculating.toFixed(2)), result['Total HELP Circulating'], 'Total HELP Circulating') ? chalk.green('PASS') : chalk.red('FAIL');;
    const helpunclaimedPASS = withinError(parseFloat(helpunclaimed.toFixed(2)), result['Unclaimed HELP Tokens All Users'], 'Unclaimed HELP Tokens All Users') ? chalk.green('PASS') : chalk.red('FAIL');;
    const c1interestPASS = withinError(parseFloat(c1interest.toFixed(2)), result['Total Interest Earned C1'], 'Total Interest Earned C1') ? chalk.green('PASS') : chalk.red('FAIL');;
    const c2interestPASS = withinError(parseFloat(c2interest.toFixed(2)), result['Total Interest Earned C2'], 'Total Interest Earned C2') ? chalk.green('PASS') : chalk.red('FAIL');;
    const c3interestPASS = withinError(parseFloat(c3interest.toFixed(2)), result['Total Interest Earned C3'], 'Total Interest Earned C3') ? chalk.green('PASS') : chalk.red('FAIL');;
    const totalinterestPASS = withinError(parseFloat(totalinterest.toFixed(2)), result['Cumulative Interest Earned USD'], 'Cumulative Interest Earned USD') ? chalk.green('PASS') : chalk.red('FAIL');;
    const charitypoolPASS = withinError(parseFloat(charitypool.toFixed(2)), result['Cumulative Charity Pool DAI'], 'Cumulative Charity Pool DAI') ? chalk.green('PASS') : chalk.red('FAIL');;
    const devpoolPASS = withinError(parseFloat(devpool.toFixed(2)), result['Cumulative Dev Pool DAI'], 'Cumulative Dev Pool DAI') ? chalk.green('PASS') : chalk.red('FAIL');;
    const stakepoolPASS = withinError(parseFloat(stakepool.toFixed(2)), result['Cumulative Staking Pool DAI'], 'Cumulative Staking Pool DAI') ? chalk.green('PASS') : chalk.red('FAIL');;
    const c1walletPASS = withinError(parseFloat(c1wallet.toFixed(2)), result['C1 Wallet Balance DAI'], 'C1 Wallet Balance DAI') ? chalk.green('PASS') : chalk.red('FAIL');;
    const c2walletPASS = withinError(parseFloat(c2wallet.toFixed(2)), result['C2 Wallet Balance DAI'], 'C2 Wallet Balance DAI') ? chalk.green('PASS') : chalk.red('FAIL');;
    const c3walletPASS = withinError(parseFloat(c3wallet.toFixed(2)), result['C3 Wallet Balance DAI'], 'C3 Wallet Balance DAI') ? chalk.green('PASS') : chalk.red('FAIL');;
    const user1helpPASS = withinError(parseFloat(user1help.toFixed(2)), result['U1 HELP Balance'], 'U1 HELP Balance') ? chalk.green('PASS') : chalk.red('FAIL');;
    const user2helpPASS = withinError(parseFloat(user2help.toFixed(2)), result['U2 HELP Balance'], 'U2 HELP Balance') ? chalk.green('PASS') : chalk.red('FAIL');;
    const user1xhelpPASS = withinError(parseFloat(user1xhelp.toFixed(2)), result['U1 XHELP Balance'], 'U1 XHELP Balance') ? chalk.green('PASS') : chalk.red('FAIL');;
    const user2xhelpPASS = withinError(parseFloat(user2xhelp.toFixed(2)), result['U2 XHELP Balance'], 'U2 XHELP Balance') ? chalk.green('PASS') : chalk.red('FAIL');;
    //const xhelpratioPASS = withinError(parseFloat(xhelpratio.toFixed(2)), result['XHELP/HELP Ratio']) ? chalk.green('PASS') : chalk.red('FAIL');;

    console.log('   OUTPUT:', '\t\t\t\t', 'CONTRACT:', '\t', 'VALIDATION:', '\t', 'P/F');
    console.log('   Contribution Balance C1 DAI', '\t\t', parseFloat(c1contributions.toFixed(2)), '\t\t', result['Contribution Balance C1 DAI'], '\t\t', c1contributionsPASS);
    console.log('   Contribution Balance C2 USDC', '\t', parseFloat(c2contributions.toFixed(2)), '\t\t', result['Contribution Balance C2 USDC'], '\t\t', c2contributionsPASS);
    console.log('   Contribution Balance C3 DAI', '\t\t', parseFloat(c3contributions.toFixed(2)), '\t\t', result['Contribution Balance C3 DAI'], '\t\t', c2contributionsPASS);
    console.log('   Phase', '\t\t\t\t', phase, '\t\t', result['Phase'], '\t\t', phasePASS);
    console.log('   Total HELP Supply', '\t\t\t', parseFloat(helpsupply.toFixed(2)), '\t', result['Total HELP Supply'], '\t', helpsupplyPASS);
    console.log('   Total HELP Circulating', '\t\t', parseFloat(helpcirculating.toFixed(2)), '\t\t', result['Total HELP Circulating'], '\t\t', helpcirculatingPASS);
    console.log('   Unclaimed HELP Tokens', '\t\t', parseFloat(helpunclaimed.toFixed(2)), '\t\t', result['Unclaimed HELP Tokens All Users'], '\t\t', helpunclaimedPASS);
    console.log('   Total Interest Earned C1', '\t\t', parseFloat(c1interest.toFixed(2)), '\t\t', result['Total Interest Earned C1'], '\t\t', c1interestPASS);
    console.log('   Total Interest Earned C2', '\t\t', parseFloat(c2interest.toFixed(2)), '\t\t', result['Total Interest Earned C2'], '\t\t', c2interestPASS);
    console.log('   Total Interest Earned C3', '\t\t', parseFloat(c3interest.toFixed(2)), '\t\t', result['Total Interest Earned C3'], '\t\t', c3interestPASS);
    console.log('   Cumulative Interest Earned USD', '\t', parseFloat(totalinterest.toFixed(2)), '\t\t', result['Cumulative Interest Earned USD'], '\t\t', totalinterestPASS);
    console.log('   Charity Interest Pools', '\t\t', parseFloat(charitypool.toFixed(2)), '\t\t', result['Cumulative Charity Pool DAI'], '\t\t', charitypoolPASS);
    console.log('   Development Pool', '\t\t\t', parseFloat(devpool.toFixed(2)), '\t\t', result['Cumulative Dev Pool DAI'], '\t\t', devpoolPASS);
    console.log('   Staking Rewards', '\t\t\t', parseFloat(stakepool.toFixed(2)), '\t\t', result['Cumulative Staking Pool DAI'], '\t\t', stakepoolPASS);
    console.log('   C1 Wallet Balance DAI', '\t\t', parseFloat(c1wallet.toFixed(2)), '\t\t', result['C1 Wallet Balance DAI'], '\t\t', c1walletPASS);
    console.log('   C2 Wallet Balance DAI', '\t\t', parseFloat(c2wallet.toFixed(2)), '\t\t', result['C2 Wallet Balance DAI'], '\t\t', c2walletPASS);
    console.log('   C3 Wallet Balance DAI', '\t\t', parseFloat(c3wallet.toFixed(2)), '\t\t', result['C3 Wallet Balance DAI'], '\t\t', c3walletPASS);
    console.log('   U1 HELP Balance', '\t\t\t', parseFloat(user1help.toFixed(2)), '\t\t', result['U1 HELP Balance'], '\t\t', user1helpPASS);
    console.log('   U2 HELP Balance', '\t\t\t', parseFloat(user2help.toFixed(2)), '\t\t', result['U2 HELP Balance'], '\t\t', user2helpPASS);
    console.log('   U1 xHELP Balance', '\t\t\t', parseFloat(user1xhelp.toFixed(2)), '\t\t', result['U1 XHELP Balance'], '\t\t', user1xhelpPASS);
    console.log('   U2 xHELP Balance', '\t\t\t', parseFloat(user2xhelp.toFixed(2)), '\t\t', result['U2 XHELP Balance'], '\t\t', user2xhelpPASS);
    //console.log('   xHELP/HELP Ratio', '\t\t\t', parseFloat(xhelpratio.toFixed(2)), '\t\t', result['XHELP/HELP Ratio'], '\t\t', xhelpratioPASS);

  };

  const rewardStep = async () => {
    await xhelp.distributeRewards();
  };


  const upkeepStep = async () => {

    const upkeepTx = await ihelp.upkeep();
    await upkeepTx.wait(1);

    // const incrementTx = await ihelp.incrementTotalInterest([charity1Address,charity2Address,charity3Address]);
    // await incrementTx.wait(1);

  };

  const calculateAccrualValueDai = async (value) => {
    // const c1bTx = await cdai.balanceOfUnderlying(contributionsAggregator.address);
    // const c1b = (c1bTx.toString());
    // //console.log('c1b', c1b);

    // const c3bTx = await cdai.balanceOfUnderlying(charityPool3.address);
    // const c3b = (c3bTx.toString());
    // //console.log('c3b', c3b);

    // const totalb = Big(c1b).plus(c3b);
    // //console.log('totalb', totalb.toFixed(0));


    const c1bTx = await cdai.balanceOfUnderlying(contributionsAggregator.address);
    const totalb = Big(c1bTx.toString());
    
    const getCashTx = await cdai.getCash();
    const getCash = getCashTx.toString();
    //console.log('getCash', getCash);

    const percentofcdai = totalb.times(1e18).div(getCash);
    //console.log('percentCDAI', percentofcdai.toFixed(0));

    const accrualValue = web3.utils.toWei(Big(value).times(1e18).div(percentofcdai).toFixed(0));
    //console.log('accrualValue', accrualValue);

    return accrualValue;

  };

  const calculateAccrualValueUsdc = async (value) => {

    // const c2bTx = await cusdc.balanceOfUnderlying(charityPool2.address);
    // const c2b = (c2bTx.toString());
    //console.log('c2b', c2b);
    // TODO: @Matt, check this, please

    const c2bTx = await cusdc.balanceOfUnderlying(contributionsAggregator.address);
    const c2b = (c2bTx.toString());

    const totalb = Big(c2b);
    //console.log('totalb', totalb.toFixed(0));

    const getCashTx = await cusdc.getCash();
    const getCash = getCashTx.toString();
    //console.log('getCash', getCash);

    const percentofcusdc = totalb.times(1e6).div(getCash);
    //console.log('percentCUSDC', percentofcusdc.toFixed(0));

    const accrualValue = ethers.utils.parseUnits(Big(value).times(1e6).div(percentofcusdc).toFixed(0), usdcDecimals).toString();
    console.log('accrualValue', accrualValue);

    return accrualValue;

  };


  let INPUT = 0;
  console.log('\n*** INPUT', INPUT, '***');
  await getOutputs(INPUT);

  INPUT = 1;
  console.log('\n*** INPUT', INPUT, '***');

  // make a deposit
  const approvalTx1u1 = await dai.connect(userSigner1).approve(charityPool1.address, web3.utils.toWei('100'));
  await approvalTx1u1.wait();
  const sponsorTx1u1 = await charityPool1.connect(userSigner1).depositTokens(cDaiAddress, web3.utils.toWei('100'), "Test Memo");
  await sponsorTx1u1.wait();

  const approvalTx1u2 = await dai.connect(userSigner2).approve(charityPool1.address, web3.utils.toWei('2500'));
  await approvalTx1u2.wait();
  const sponsorTx1u2 = await charityPool1.connect(userSigner2).depositTokens(cDaiAddress, web3.utils.toWei('2500'), "Test Memo");
  await sponsorTx1u2.wait();
  await getOutputs(INPUT);

  INPUT = 2;
  console.log('\n*** INPUT', INPUT, '***');

  // make a deposit for user 1
  const approvalTx2u1 = await usdc.connect(userSigner1).approve(charityPool2.address, ethers.utils.parseUnits('1000', usdcDecimals));
  await approvalTx2u1.wait();
  const sponsorTx2u1 = await charityPool2.connect(userSigner1).depositTokens(cUsdcAddress, ethers.utils.parseUnits('1000', usdcDecimals), "Test Memo");
  await sponsorTx2u1.wait();

  const approval2Tx2u1 = await dai.connect(userSigner1).approve(charityPool3.address, web3.utils.toWei('1500'));
  await approval2Tx2u1.wait();
  const sponsor2Tx2u1 = await charityPool3.connect(userSigner1).depositTokens(cDaiAddress, web3.utils.toWei('1500'), "Test Memo");
  await sponsor2Tx2u1.wait();

  // make a deposit for user 2
  const approvalTx2u2 = await usdc.connect(userSigner2).approve(charityPool2.address, ethers.utils.parseUnits('1500', usdcDecimals));
  await approvalTx2u2.wait();
  const sponsorTx2u2 = await charityPool2.connect(userSigner2).depositTokens(cUsdcAddress, ethers.utils.parseUnits('1500', usdcDecimals), "Test Memo");
  await sponsorTx2u2.wait();


  await getOutputs(INPUT);


  INPUT = 3;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  let aval = await calculateAccrualValueDai(260000);
  const accrue3TxDai = await cdai.accrueCustom(aval);
  await accrue3TxDai.wait();

  aval = await calculateAccrualValueUsdc(240000);
  const accrue3TxUsdc = await cusdc.accrueCustom(aval);
  await accrue3TxUsdc.wait();

  await upkeepStep();

  yellow("Upkeep finished, claiming 50000 tokens ");

  // claim the HELP tokens
  const claim4Txu1 = await ihelp.connect(userSigner1).claimSpecificTokens(web3.utils.toWei('50000'));
  await claim4Txu1.wait();

  // // take the staking pool dai amount and distribute this across stakers
  const approvalTx4u1 = await ihelp.connect(userSigner1).approve(xhelpAddress, web3.utils.toWei('50000'));

  await approvalTx4u1.wait();

  const stakeTx4u1 = await xhelp.connect(userSigner1).deposit(web3.utils.toWei('50000'));
  await stakeTx4u1.wait();

  await rewardStep();

  yellow("Getting outputs ");

  await getOutputs(INPUT);

  
  INPUT = 4;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  aval = await calculateAccrualValueDai(370000);
  const accrue4TxDai = await cdai.accrueCustom(aval);
  await accrue4TxDai.wait();

  aval = await calculateAccrualValueUsdc(330000);
  const accrue4TxUsdc = await cusdc.accrueCustom(aval);
  await accrue4TxUsdc.wait();

  await upkeepStep();

  await rewardStep();

  await getOutputs(INPUT);


  INPUT = 5;
  console.log('\n*** INPUT', INPUT, '***');

  await getOutputs(INPUT);

  return true;

  INPUT = 6;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  aval = await calculateAccrualValueDai(550000);
  const accrue6TxDai = await cdai.accrueCustom(aval);
  await accrue6TxDai.wait();

  aval = await calculateAccrualValueUsdc(450000);
  const accrue6TxUsdc = await cusdc.accrueCustom(aval);
  await accrue6TxUsdc.wait();

  await upkeepStep();

  await getOutputs(INPUT);


  INPUT = 7;
  console.log('\n*** INPUT', INPUT, '***');

  // withdraw from the pools
  const withdraw71Txu1 = await charityPool2.connect(userSigner1).withdrawTokens(ethers.utils.parseUnits('500', usdcDecimals));
  await withdraw71Txu1.wait();

  const withdraw72Txu1 = await charityPool3.connect(userSigner1).withdrawTokens(ethers.utils.parseUnits('500', daiDecimals));
  await withdraw72Txu1.wait();

  //await upkeepStep();
  await getOutputs(INPUT);


  INPUT = 8;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  aval = await calculateAccrualValueDai(600000);
  const accrue8TxDai = await cdai.accrueCustom(aval);
  await accrue8TxDai.wait();

  aval = await calculateAccrualValueUsdc(400000);
  const accrue8TxUsdc = await cusdc.accrueCustom(aval);
  await accrue8TxUsdc.wait();

  await upkeepStep();

  await getOutputs(INPUT);

  INPUT = 9;
  console.log('\n*** INPUT', INPUT, '***');

  // claim the HELP tokens
  const claim9Txu1 = await ihelp.connect(userSigner1).claimSpecificTokens(web3.utils.toWei('20000'));
  await claim9Txu1.wait();

  await upkeepStep();
  await getOutputs(INPUT);


  INPUT = 10;
  console.log('\n*** INPUT', INPUT, '***');

  // stake the HELP tokens to xHELP
  const approvalTx10u1 = await ihelp.connect(userSigner1).approve(xhelpAddress, web3.utils.toWei('20000'));
  await approvalTx10u1.wait();
  const stakeTx10u1 = await xhelp.connect(userSigner1).deposit(web3.utils.toWei('20000'));
  await stakeTx10u1.wait();

  await getOutputs(INPUT);


  INPUT = 11;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  aval = await calculateAccrualValueDai(550000);
  const accrue11TxDai = await cdai.accrueCustom(aval);
  await accrue11TxDai.wait();

  aval = await calculateAccrualValueUsdc(400000);
  const accrue11TxUsdc = await cusdc.accrueCustom(aval);
  await accrue11TxUsdc.wait();

  await upkeepStep();

  await getOutputs(INPUT);

  //process.exit(0)

  INPUT = 12;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  aval = await calculateAccrualValueDai(150000);
  const accrue12TxDai = await cdai.accrueCustom(aval);
  await accrue12TxDai.wait();

  aval = await calculateAccrualValueUsdc(100000);
  const accrue12TxUsdc = await cusdc.accrueCustom(aval);
  await accrue12TxUsdc.wait();

  await upkeepStep();

  await getOutputs(INPUT);

  INPUT = 13;
  console.log('\n*** INPUT', INPUT, '***');

  // claim the HELP tokens
  const claim13Txu1 = await ihelp.connect(userSigner2).claimSpecificTokens(web3.utils.toWei('10000'));
  await claim13Txu1.wait();

  await upkeepStep();
  await getOutputs(INPUT);

  INPUT = 14;
  console.log('\n*** INPUT', INPUT, '***');

  const withdraw14Tx = await xhelp.connect(userSigner1).withdraw(web3.utils.toWei('10000'));
  await withdraw14Tx.wait();

  await upkeepStep();

  await getOutputs(INPUT);

  INPUT = 15;
  console.log('\n*** INPUT', INPUT, '***');

  // claim the HELP tokens
  const claim15Txu1 = await ihelp.connect(userSigner1).claimSpecificTokens(web3.utils.toWei('900000'));
  await claim15Txu1.wait();

  await upkeepStep();

  await getOutputs(INPUT);

  INPUT = 16;
  console.log('\n*** INPUT', INPUT, '***');

  // stake the HELP tokens to xHELP
  const approvalTx16u2 = await ihelp.connect(userSigner2).approve(xhelpAddress, web3.utils.toWei('5000'));
  await approvalTx16u2.wait();
  const stakeTx16u2 = await xhelp.connect(userSigner2).deposit(web3.utils.toWei('5000'));
  await stakeTx16u2.wait();

  await getOutputs(INPUT);

  INPUT = 17;
  console.log('\n*** INPUT', INPUT, '***');

  // make a deposit
  const approvalTx17u1 = await dai.connect(userSigner1).approve(charityPool1.address, web3.utils.toWei('1500'));
  await approvalTx17u1.wait();
  const sponsorTx17u1 = await charityPool1.connect(userSigner1).depositTokens(web3.utils.toWei('1500'));
  await sponsorTx17u1.wait();

  await getOutputs(INPUT);

  INPUT = 18;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  aval = await calculateAccrualValueDai(725000);
  const accrue18TxDai = await cdai.accrueCustom(aval);
  await accrue18TxDai.wait();

  aval = await calculateAccrualValueUsdc(275000);
  const accrue18TxUsdc = await cusdc.accrueCustom(aval);
  await accrue18TxUsdc.wait();

  await upkeepStep();

  await getOutputs(INPUT);


  INPUT = 19;
  console.log('\n*** INPUT', INPUT, '***');

  // claim the HELP tokens
  const claim19Txu2 = await ihelp.connect(userSigner2).claimSpecificTokens(web3.utils.toWei('10000'));
  await claim19Txu2.wait();

  await upkeepStep();

  await getOutputs(INPUT);


  INPUT = 20;
  console.log('\n*** INPUT', INPUT, '***');

  // stake the HELP tokens to xHELP
  const approvalTx20u2 = await ihelp.connect(userSigner2).approve(xhelpAddress, web3.utils.toWei('10000'));
  await approvalTx20u2.wait();
  const stakeTx20u2 = await xhelp.connect(userSigner2).deposit(web3.utils.toWei('10000'));
  await stakeTx20u2.wait();

  await getOutputs(INPUT);


  INPUT = 21;
  console.log('\n*** INPUT', INPUT, '***');

  const withdraw21Tx = await xhelp.connect(userSigner1).withdraw(web3.utils.toWei('5000'));
  await withdraw21Tx.wait();

  await upkeepStep();

  await getOutputs(INPUT);

  INPUT = 22;
  console.log('\n*** INPUT', INPUT, '***');

  // withdraw from the pools
  const withdraw22Txu2 = await charityPool1.connect(userSigner2).withdrawTokens(ethers.utils.parseUnits('2500', daiDecimals));
  await withdraw22Txu2.wait();

  //await upkeepStep();
  await getOutputs(INPUT);

  INPUT = 23;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  aval = await calculateAccrualValueDai(350000);
  const accrue23TxDai = await cdai.accrueCustom(aval);
  await accrue23TxDai.wait();

  aval = await calculateAccrualValueUsdc(650000);
  const accrue23TxUsdc = await cusdc.accrueCustom(aval);
  await accrue23TxUsdc.wait();

  await upkeepStep();

  await getOutputs(INPUT);

  INPUT = 24;
  console.log('\n*** INPUT', INPUT, '***');

  // make a deposit
  const approvalTx24u1 = await dai.connect(userSigner1).approve(charityPool1.address, web3.utils.toWei('10000'));
  await approvalTx24u1.wait();
  const sponsorTx24u1 = await charityPool1.connect(userSigner1).depositTokens(web3.utils.toWei('10000'));
  await sponsorTx24u1.wait();

  const approvalTx241u1 = await dai.connect(userSigner1).approve(charityPool3.address, web3.utils.toWei('5000'));
  await approvalTx241u1.wait();
  const sponsorTx241u1 = await charityPool3.connect(userSigner1).depositTokens(web3.utils.toWei('5000'));
  await sponsorTx241u1.wait();

  const approvalTx24u2 = await dai.connect(userSigner2).approve(charityPool1.address, web3.utils.toWei('5000'));
  await approvalTx24u2.wait();
  const sponsorTx24u2 = await charityPool1.connect(userSigner2).depositTokens(web3.utils.toWei('5000'));
  await sponsorTx24u2.wait();

  // make a deposit for user 2
  const approvalTx241u2 = await usdc.connect(userSigner2).approve(charityPool2.address, ethers.utils.parseUnits('7500', usdcDecimals));
  await approvalTx241u2.wait();
  const sponsorTx241u2 = await charityPool2.connect(userSigner2).depositTokens(ethers.utils.parseUnits('7500', usdcDecimals, "Test Memo"));
  await sponsorTx241u2.wait();

  await getOutputs(INPUT);

  INPUT = 25;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  aval = await calculateAccrualValueDai(800000);
  const accrue25TxDai = await cdai.accrueCustom(aval);
  await accrue25TxDai.wait();

  aval = await calculateAccrualValueUsdc(200000);
  const accrue25TxUsdc = await cusdc.accrueCustom(aval);
  await accrue25TxUsdc.wait();

  await upkeepStep();

  await getOutputs(INPUT);


  INPUT = 26;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  aval = await calculateAccrualValueDai(200000);
  const accrue26TxDai = await cdai.accrueCustom(aval);
  await accrue26TxDai.wait();

  aval = await calculateAccrualValueUsdc(50000);
  const accrue26TxUsdc = await cusdc.accrueCustom(aval);
  await accrue26TxUsdc.wait();

  const withdraw26Tx = await xhelp.connect(userSigner2).withdraw(web3.utils.toWei('300'));
  await withdraw26Tx.wait();

  await upkeepStep();

  await getOutputs(INPUT);

  INPUT = 27;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  aval = await calculateAccrualValueDai(800000);
  const accrue27TxDai = await cdai.accrueCustom(aval);
  await accrue27TxDai.wait();

  aval = await calculateAccrualValueUsdc(200000);
  const accrue27TxUsdc = await cusdc.accrueCustom(aval);
  await accrue27TxUsdc.wait();

  await upkeepStep();

  await getOutputs(INPUT);

  INPUT = 28;
  console.log('\n*** INPUT', INPUT, '***');

  // claim the HELP tokens
  const claim28Txu2 = await ihelp.connect(userSigner2).claimSpecificTokens(web3.utils.toWei('500000'));
  await claim28Txu2.wait();

  await upkeepStep();

  await getOutputs(INPUT);

  INPUT = 29;
  console.log('\n*** INPUT', INPUT, '***');

  // withdraw from the pools
  const withdraw291Txu1 = await charityPool2.connect(userSigner1).withdrawTokens(ethers.utils.parseUnits('500', usdcDecimals));
  await withdraw291Txu1.wait();

  const withdraw291Txu2 = await charityPool2.connect(userSigner2).withdrawTokens(ethers.utils.parseUnits('9000', usdcDecimals));
  await withdraw291Txu2.wait();

  // stake the HELP tokens to xHELP
  const approvalTx29u2 = await ihelp.connect(userSigner2).approve(xhelpAddress, web3.utils.toWei('5000'));
  await approvalTx29u2.wait();
  const stakeTx29u2 = await xhelp.connect(userSigner2).deposit(web3.utils.toWei('5000'));
  await stakeTx29u2.wait();

  await upkeepStep();
  await getOutputs(INPUT);

  INPUT = 30;
  console.log('\n*** INPUT', INPUT, '***');

  // accrue the cdai interest
  // to accrue the interest by an exact, we need to accrue by the share of charity pools relative to the entire cdai cash
  //console.log('accuring the interest...')
  aval = await calculateAccrualValueDai(1000000);
  const accrue30TxDai = await cdai.accrueCustom(aval);
  await accrue30TxDai.wait();

  await upkeepStep();

  await getOutputs(INPUT);


};

module.exports = {
  validate
};
// validate();
