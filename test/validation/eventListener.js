const hardhat = require("hardhat");
const { Web3LogListener } = require('../../scripts/utils/wsLogs')
const { yellow, dim } = require("../../scripts/deployUtils");

let charityPool1;



const main = async () => {
    // Prepare the environment
    await setup();

    // Start the listener
    runListener('ws://localhost:7545');

    // Get a ctoken to make the donation
    const ctoken = await charityPool1.getCTokens().then(data => data[0]);
    setInterval(async () => {
        await charityPool1.directDonation(ctoken, 1);
    }, 2000)
}


const setup = async () => {
    const [deployer] = await hardhat.ethers.getSigners();

    const charity1Address = (await hardhat.deployments.get('charityPool1')).address;
    charityPool1 = await hardhat.ethers.getContractAt('CharityPool', charity1Address);

    const cDaiAddress = (await hardhat.deployments.get('cDAI')).address;
    let cdai = await hardhat.ethers.getContractAt('CTokenMock', cDaiAddress);

    await charityPool1.addCToken(cdai.address);

    const daiDeployment = await hardhat.deployments.get('DAI');
    const DAI = await hardhat.ethers.getContractAt('ERC20MintableMock', daiDeployment.address);
    await DAI.mint(deployer.address, 10);

    await DAI.approve(charityPool1.address, 10);

}

// The listener configuration
const runListener = async (nodeUrl) => {
    const contract = charityPool1;
    const filter = contract.filters.DirectDonation();

    const eventListener = Web3LogListener(nodeUrl, filter);

    eventListener.start((data) => {
        yellow(":::NEW EVENT::::");
        dim(JSON.stringify(data));
    })
}

main();

