const { parseUnits } = require("ethers/lib/utils");
const hardhat = require("hardhat");
const { cyan,yellow,fromBigNumber,green,dim, red } = require('./deployUtils');

const run = async () => {
    const { deployer } = await hardhat.getNamedAccounts();
    const signer = hardhat.ethers.provider.getSigner(deployer);

    console.log('signer:',signer._address)
    
    const ihelpAddress = (await hardhat.deployments.get('iHelp')).address;
    // const ihelp = await hardhat.ethers.getContractAt('iHelpToken', ihelpAddress, signer);
   
    const analyticsContract = await hardhat.deployments.get('analytics');
    const analytics = new hardhat.ethers.Contract(analyticsContract.address, analyticsContract.abi, signer);

    const user = '0x8D87FcE1394ad41d4149f210AB259fa30e4f731e';
    
    // const d = await analytics.userStats(ihelpAddress,user,0,30);
    // console.log(d);

    const BATCH_SIZE = 15;
    const numberOfCharities = 150;

    let index=0;
    for (let i=index;i<numberOfCharities;i=i+BATCH_SIZE) {
    
        console.log('charityBatch',i,i+BATCH_SIZE)

        console.log(await analytics.getUserContributionsPerCharity(ihelpAddress,user,i,BATCH_SIZE));

    }

    process.exit(0)

}

run();