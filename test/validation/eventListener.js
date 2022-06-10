const hardhat = require("hardhat");
const { Web3LogListener } = require('../../scripts/utils/wsLogs')
let charityPool1;
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

const main = async () => {
    const [deployer, userAccount] = await hardhat.ethers.getSigners();

    await setup();
    const runListener = async (nodeUrl) => {
        const contract = charityPool1;
        const filter = contract.filters.DirectDonation();

        const eventListener = Web3LogListener(nodeUrl, filter);

        eventListener.start((data) => {
            console.log(data);
        })
    }

    runListener('ws://localhost:7545');

    const ctoken = await charityPool1.getCTokens().then(data => data[0]);
    console.log(ctoken);
    setInterval(async () => {
        await charityPool1.directDonation(ctoken, 1);
    }, 2000)
}

main();

