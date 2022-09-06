const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
const path = require('path')

const { getChainId, network } = require('hardhat');
const { chainName, green, yellow, dim, fromBigNumber, getLendingConfigurations, cyan,runRpcTest } = require("./deployUtils");

let deployer;

const getBalances = async(cToken,charityInstance,lender,currency,underlyingDecimals) =>{
    let cTokenBalanceRaw  = await cToken.balanceOf(charityInstance.address);
    let cTokenDecimals  = await cToken.decimals();

    let cTokenBalance = null;
    if (lender == 'aave') {
        cTokenBalance = cTokenBalanceRaw/Math.pow(10,underlyingDecimals)
    }
    else if (lender == 'traderjoe') {
        // multiply by the exchange rate
        const tToken = await hardhat.ethers.getContractAt("TJErc20", currency.lendingAddress);
        const exchangeRate = await tToken.exchangeRateStored();
        
        // This seems strange the exchange rate comes back in a different decimal - something may be wrong here
        // scaledCTokens = cTokenBalanceRaw.div( BigInt(10)**BigInt(cTokenDecimals) );
        // scaledExchangeRate = exchangeRate.div( (BigInt(10) ** BigInt(18-8+underlyingDecimals)) );
        // cTokenBalanceRaw = scaledCTokens*scaledExchangeRate;
        // cTokenBalance = cTokenBalanceRaw/Math.pow(10,cTokenDecimals)   

        cTokenBalanceRaw = cTokenBalanceRaw.mul(exchangeRate)/Math.pow(10,18)
        cTokenBalance = cTokenBalanceRaw/Math.pow(10,underlyingDecimals)

        //process.exit(0)
    }
    return {cTokenBalanceRaw,cTokenBalance}
}

let sumBalances = 0;
let sumLenderBalances = 0;

const getBalanceDetails = async(charityInstance,configurations) => {

    for (let i=0;i<Object.keys(configurations).length;i++) {

        const lender = Object.keys(configurations)[i];
        //console.log(lender)

        // if (lender != 'traderjoe') {
        //     continue
        // }

        for (let j=0;j<Object.keys(configurations[lender]).length;j++) {
        
            const token = Object.keys(configurations[lender])[j];

            const currency = configurations[lender][token];

            const balance = await charityInstance.accountedBalances(currency.lendingAddress)

            if (balance > 0) {

                const decimals = await charityInstance.decimals(currency.lendingAddress);

                const accountedBalance = balance/Math.pow(10,decimals);
                sumBalances+=accountedBalance;

                console.log('   ',lender,token,'balance',accountedBalance)

                cToken = await hardhat.ethers.getContractAt("ERC20", currency.lendingAddress);
                
                let balances = await getBalances(cToken,charityInstance,lender,currency,decimals);

                console.log('   ',lender,token,'lenderbalance',balances.cTokenBalance)
                

                sumLenderBalances+=balances.cTokenBalance;


                const CORRECT_BALANCES = true;

                if (CORRECT_BALANCES) {
                    const currentInterestEarned = await charityInstance.currentInterestEarned(currency.lendingAddress);
                    if (currentInterestEarned != 0) {
                        console.log('     currentInterestEarned',currentInterestEarned/Math.pow(10,decimals))
                        yellow('     setting currentInterestEarned to 0...')
                        await charityInstance.setCurrentInterestEarned(currency.lendingAddress,0);
                    }
                }

                if (accountedBalance > balances.cTokenBalance) {

                    const difference = balance - balances.cTokenBalanceRaw;
                    yellow('     balance > lenderbalance - correcting by',difference/Math.pow(10,decimals) );

                    if (CORRECT_BALANCES) {

                        const tokenContract = await hardhat.ethers.getContractAt("ERC20", currency.underlyingToken);

                        console.log('     signer balance:',(await tokenContract.balanceOf(signer._address))/Math.pow(10,decimals));
    
                        let approve = await tokenContract.approve(charityInstance.address,difference.toString());
                        await approve.wait();
    
                        await charityInstance.lenderCorrection(currency.lendingAddress,difference.toString());
    
                        balances = await getBalances(cToken,charityInstance,lender,currency,decimals);
                        console.log('    ',lender,token,'new lenderbalance',balances.cTokenBalance)
                    }

                    // process.exit(0)

                }

                

            }
            
       
        }

    }

}

const contributionValidation = async() => {

    let {
        deployer
    } = await hardhat.getNamedAccounts();
    
    signer = await hardhat.ethers.provider.getSigner(deployer);

    // get all lenders
    const configurations = await getLendingConfigurations();
    //console.log(configurations)
        
    // get all charities
    const FILE_DIR = 'build'
    const FILE_PATH = path.join(FILE_DIR, `${network.name}_charities.json`);

    let deployedCharities = [];
    let result = [];

    if (fs.existsSync(FILE_PATH)) {
        const fileData = fs.readFileSync(FILE_PATH, { encoding: 'utf-8' });
        deployedCharities = JSON.parse(fileData);
    }

    const existing = [];
    let i=0;
    for (const charity of deployedCharities) {

        // console.log(charityCount,'/',deployedCharities.length-1,charity.charityName);

        i+=1;

        // if (charity.charityName != 'Girls Who Code Inc') {
        //     continue
        // }
        
        // get all contributors per charity
        charityInstance = await hardhat.ethers.getContractAt("CharityPool", charity.address);
        const contributors = await charityInstance.getContributors();
        
        if (contributors.length > 0) {

            console.log(charity.charityName,charity.address);
            //console.log(contributors);

            // for (const contributor of contributors) {
            //     console.log('contributor',contributor);

            await getBalanceDetails(charityInstance,configurations)
                
            //}
  
        }

        // process.exit(0)


    }


    console.log('\nBalance Sum:',sumBalances);
    console.log('Lender Balance Sum:',sumLenderBalances);

    const interestGenerated = sumLenderBalances - sumBalances;
    console.log('Interest Generated:',interestGenerated)

}

contributionValidation()