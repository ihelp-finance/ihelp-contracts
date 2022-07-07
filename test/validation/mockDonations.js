const hardhat = require("hardhat");
const { yellow, cyan } = require("../../scripts/deployUtils");

let charityPool1;

const main = async () => {
    // Prepare the environment
    await setup();

    // Get a ctoken to make the donation
    const ctoken = await charityPool1.getCTokens().then(data => data[0]);
    setInterval(async () => {
        cyan("Sending direct donation...")
        await charityPool1.directDonation(ctoken, 1);
    }, 2000)
}


const setup = async () => {
    yellow("Setting up mock environment...")
    const [deployer] = await hardhat.ethers.getSigners();

    const charity1Address = (await hardhat.deployments.get('charityPool1')).address;
    charityPool1 = await hardhat.ethers.getContractAt('CharityPool', charity1Address);

    const daiDeployment = await hardhat.deployments.get('DAI');
    const DAI = await hardhat.ethers.getContractAt('ERC20MintableMock', daiDeployment.address);
    await DAI.mint(deployer.address, 100);

    await DAI.approve(charityPool1.address, 100);
}
main();

