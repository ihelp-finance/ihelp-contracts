const { parseUnits } = require("ethers/lib/utils");
const hardhat = require("hardhat");
const { cyan,yellow,fromBigNumber,green,dim, red } = require('./deployUtils');

const run = async () => {
    const { deployer } = await hardhat.getNamedAccounts();
    const signer = hardhat.ethers.provider.getSigner(deployer);
    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
    const ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);

    console.log('signer:',signer._address)

    const migrate = async (charity) => {
        dim(`      migrating batch of contributors`);
        const tx = await charity.migrate(0, 0);
        const recepit = await tx.wait();
        dim(`      migrations complete for batch`);
    }

    const charities = await ihelp.getCharities();

    const contributorAggregatorAddress = (await hardhat.deployments.get('ContributionsAggregator')).address;

    const contributionsAggregator = await hardhat.ethers.getContractAt('ContributionsAggregator', contributorAggregatorAddress, signer);

    const analyticsContract = await hardhat.deployments.get('analytics');
    const analytics = new hardhat.ethers.Contract(analyticsContract.address, analyticsContract.abi, signer);

    const supportedCurrencies = await analytics.getSupportedCurrencies(ihelpAddress,4000);
  
    const charitiesWithContributions = [];
    for (const [ci,charityAddress] of charities.entries()) {

        // if (ci < 97) {
        //     continue
        // }

        const charity = await hardhat.ethers.getContractAt('CharityPool', charityAddress, signer);
        const charityname = await charity.name();

        // if (charityname != 'Girls Who Code Inc') {
        //     continue
        // }

        const numberOfContributors = await charity.numberOfContributors();

        if (numberOfContributors > 0) {

            yellow(ci+1,'/',charities.length,'- migrating',numberOfContributors.toString(),'contributors in',charityname);
            
            cyan('   total usd interest earned in charity',fromBigNumber(await charity.totalInterestEarnedUSD()));

            let charityContributionCounter = 0;
            for (const currency of supportedCurrencies) {
                await new Promise(resolve => setTimeout(resolve, 10));
                charityContributionCounter+=parseFloat(hardhat.ethers.utils.formatUnits(await charity.deposited(currency['lendingAddress']),currency['decimals'])) *parseFloat(hardhat.ethers.utils.formatUnits(currency['price'], currency['priceDecimals']))
            }

            cyan('   total usd contribution in charity counter',charityContributionCounter);

            let charityAccountedBalance = 0;
            for (const currency of supportedCurrencies) {
                await new Promise(resolve => setTimeout(resolve, 10));
                charityAccountedBalance += parseFloat(hardhat.ethers.utils.formatUnits(await contributionsAggregator.charityAccountedBalance(charity.address, currency['lendingAddress']), currency['decimals']))*parseFloat(hardhat.ethers.utils.formatUnits(currency['price'], currency['priceDecimals']))
            }

            yellow('   pre-migration total USD contribution in charity aggregator',charityAccountedBalance);

            if (charityAccountedBalance != charityContributionCounter) {

                // const contributors = await charity.getContributors();
                // for (const contributor of contributors) {
                //     // const accountedBalance = 
                //     const contribBalance = fromBigNumber(await contributorAggregator.contributorAccountedBalance(owner.address, cTokenMock.address));
                // }

                //await contributorAggregator.contributorAccountedBalance(owner.address, cTokenMock.address);

                // match the charity pool balance counter to the contributorAggregator.contributorAccountedBalance
                // const owner_cTokenAccountedBalance = await contributionsAggregator.contributorAccountedBalance(owner.address, cTokenMock.address);
                // const charity_cTokenAccountedBalance = await contributionsAggregator.charityAccountedBalance(charityPool.address, cTokenMock.address); == charity.accountedBalanceUSD()

                await migrate(charity,numberOfContributors);

                let charityAccountedBalancePost = 0;
                for (const currency of supportedCurrencies) {
                    charityAccountedBalancePost += parseFloat(hardhat.ethers.utils.formatUnits(await contributionsAggregator.charityAccountedBalance(charity.address, currency['lendingAddress']), currency['decimals']))*parseFloat(hardhat.ethers.utils.formatUnits(currency['price'], currency['priceDecimals']))
                }

                green('   post-migration total USD contribution in charity aggregator',charityAccountedBalancePost);

                if (charityAccountedBalancePost != charityContributionCounter) {
                    red('WARNING - migrated balances not matching...')
                    process.exit(1)
                }
                //process.exit(0)

            }

            // revise upkeep (for now call claim but eventually remove this)
            // await xhelp.distributeRewards();

            // reward
            // await ihelp.upkeep();

        }

    }

    process.exit(0)

}

run();