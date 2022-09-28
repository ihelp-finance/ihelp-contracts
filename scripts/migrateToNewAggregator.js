const hardhat = require("hardhat");
const { yellow } = require('./deployUtils');

const run = async () => {
    const { deployer } = await hardhat.getNamedAccounts();
    const signer = hardhat.ethers.provider.getSigner(deployer);
    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
    const ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);

    const BATCH_SIZE=10;


    // TODO: This needs to be tested
    const batchMigrate = (batchSize) => async (charityAddress, destinationWallet, confirmations = 1) => {
        const charity = await hardhat.ethers.getContractAt('CharityPool', charityAddress, signer);
        
        const numberOfContributors = await charity.numberOfContributors();
        const iterations = (numberOfContributors / batch) + 1
        
        for (let index = 0; index < iterations; index++) {
            yellow(`Migrating batch of contributors: ${index + 1}`);
            const tx = await charity.migrate(index * batchSize, batchSize);
            const recepit = await tx.wait(confirmations);
            yellow(`Migrations complete for batch: ${index + 1}`);
        }
    }


    //TODO: Maybe we want to run this just on the charities that have donations??
    const charities = await ihelp.getCharities();
    
    // Set the batch size ere
    const migrate = batchMigrate(BATCH_SIZE);
    for (const charityAddress of charities) {
        try {
            await migrate(depositWallet, charityAddress); 
        } catch (error) {
            console.log(error)
        }
    }
}

run();