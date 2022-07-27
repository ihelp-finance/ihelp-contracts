const hardhat = require("hardhat");
const { yellow, cyan } = require("../../scripts/deployUtils");

let charityPool1;

const functions = [
    "depositTokens",
    "withdrawTokens"
]

const main = async () => {
    // Prepare the environment
    await setup();

    let index = 0;
    // Get a ctoken to make the donation
    const ctoken = (await hardhat.deployments.get('cDAI')).address;
    const fn = async () => {
        cyan(`Calling ${index}:${functions[index]} ...`);
        const tx = await charityPool1[functions[index]](ctoken, 1);
        cyan(`      ${functions[index]} success hash ${await tx.wait().then(({transactionHash}) => JSON.stringify(transactionHash))}...`);

        index = (index + 1) % functions.length;
        setTimeout(fn, 2000);
    };
    fn();
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

