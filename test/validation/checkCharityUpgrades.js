const hardhat = require("hardhat");

const main = async () => {
    const charity1Address = (await hardhat.deployments.get('charityPool1')).address;
    const charityPool1 = await hardhat.ethers.getContractAt('CharityPool', charity1Address);
    console.log(await charityPool1.version());

    const charity2Address = (await hardhat.deployments.get('charityPool2')).address;
    const charityPool2 = await hardhat.ethers.getContractAt('CharityPool', charity2Address);
    console.log(await charityPool2.version());
    
    const charity3Address = (await hardhat.deployments.get('charityPool3')).address;
    const charityPool3 = await hardhat.ethers.getContractAt('CharityPool', charity3Address);
    console.log(await charityPool3.version());

}

main();

