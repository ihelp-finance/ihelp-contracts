const { getChainId, network } = require('hardhat');
const { getLendingConfigurations, addDonationCurrencies, yellow } = require("./deployUtils");

async function main() {
    const chainId = parseInt(await getChainId(), 10);

    yellow("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    yellow(`Updating Donation Currencies on chain ${chainId} ${network.name}`);
    yellow("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

    const configurations = await getLendingConfigurations(chainId); 
    const currencies = [];

    const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 43113;

    for (const lender of Object.keys(configurations)) {
        for (const token of Object.keys(configurations[lender])) {
            currencies.push({
                "currency": token.replace('c','').replace('a','').replace('j',''),
                "lender": lender,
                "underlyingToken": configurations[lender][token].underlyingToken,
                "lendingAddress": configurations[lender][token].lendingAddress,
                "priceFeed":  configurations[lender][token].priceFeed,
                "connector":  configurations[lender][token].connector
            })
        }
    }
    await addDonationCurrencies(currencies);
    console.log("✅  Success ");

}

main().then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });