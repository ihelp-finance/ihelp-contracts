
const { deployments, ethers } = require("hardhat");
const { writeFileSync } = require('fs');
const path = require('path');


module.exports.deployCharityPoolToNetwork = async ({
    charityName, operatorAddress, holdingPoolAddress, charityWalletAddress, charityTokenName, lendingTokenAddress, holdingTokenAddress, priceFeedAddress, ihelpAddress, swapperAddress, stakingPoolAddress, developmentPoolAddress
}, network) => {

    let deployedCharities = [];

    const factoryDeployment = await deployments.get("CharityPoolCloneFactory");
    const factory = await ethers.getContractAt("CharityPoolCloneFactory", factoryDeployment.address);

    const tx = await factory.createCharityPool({
        charityName,
        operatorAddress,
        holdingPoolAddress,
        charityWalletAddress,
        charityTokenName,
        lendingTokenAddress,
        holdingTokenAddress,
        priceFeedAddress,
        ihelpAddress,
        swapperAddress,
        stakingPoolAddress,
        developmentPoolAddress
    });

    const { events } = await tx.wait();
    const charityResult = events.find(Boolean);

    deployedCharities.push({
        charityName,
        address: charityResult.address
    });

    console.log('   deployed:', charityName, '   to address  ', charityResult.address, ' at network :', network);
    const FILE_PATH = path.join('deployed-charities', `${network}.json`);
    writeFileSync(FILE_PATH, JSON.stringify(deployedCharities), "UTF-8", { 'flags': 'a+' });

    return charityResult;
};
