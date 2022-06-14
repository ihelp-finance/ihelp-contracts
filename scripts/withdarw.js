const { binanceClient } = require('./utils/binance');
const hardhat = require("hardhat");

const API_KEY = '';
const SECRET = '';
const binance = binanceClient(API_KEY, SECRET);

const DepositTokens = {
    AVAX: '',
    USDT: ''
}

const run = async (depositTokenName) => {
    const depositToken = DepositTokens[depositTokenName];
    if (!depositToken) {
        throw "Invalid Deposit Token Address";
    }
    const { deployer } = await hardhat.getNamedAccounts();
    const signer = hardhat.ethers.provider.getSigner(deployer);
    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
    const ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);
    const depositWallet = await binance.getDepositWallet(depositTokenName, 'avalanchec')

    const claimCharityInterest = async (charityAddress, destinationWallet, confirmations = 1) => {
        const charity = await hardhat.ethers.getContractAt('CharityPool', charityAddress, signer);
        const tx = await charity.collectOffChainInterest(destinationWallet, depositToken);
        const recepit = await tx.wait(confirmations);
        return recepit.txid;
    }

    const charities = await ihelp.getCharities();
    
    for (const charityAddress of charities) {
        try {
            const txid = await claimCharityInterest(depositWallet, charityAddress);
            const deposit = await binance.waitForDeposit(txid, depositTokenName, 'avalanchec', 20000);
            if (depositToken === DepositTokens.AVAX) {
                //TODO: Need to add some kind of delay here, while wating for the order to execute
                //TODO: Double check this with the binance parameters
                 await binance.createMarketOrder(deposit.amount, 'AVAXUSD', 'SELL');
            } else {
                await binance.createMarketOrder(deposit.amount, 'USDTUSD', 'SELL');
            }
            await binance.transferToBankAccount('BANK_ACCOUNT', 'AMMOUNT')

            //TODO: Keep track of how much each charoty can claim
        } catch (error) {
            console.log(error)
        }
    }
}

run(process.arg[2])