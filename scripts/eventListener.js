const hardhat = require("hardhat");
const Big = require('big.js');
const ethers = require('ethers')
const axios = require('axios')

const { Web3LogListener } = require('./utils/wsLogs')

const genericErrorhandler = err => {
    console.log(err);
    process.exit(1);
}

process.on('uncaughtException', genericErrorhandler);
process.on('uncaughtExceptionMonitor', genericErrorhandler);
process.on('unhandledRejection', genericErrorhandler);

// The listener configuration
const runListener = async () => {
    
    const ihelpContract = await hardhat.deployments.get('iHelp');
    const nodeUrl = hardhat.network.config.url;
    
    console.log(`Starting listener for ${hardhat.network.name} on ${nodeUrl}...`)
    
    const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    const iHelp = new ethers.Contract(ihelpContract.address, ihelpContract.abi, provider);

    // Listen for all charity events on the connected channel
    const eventFilter = {
        topics: [
            ethers.utils.id("DirectDonation(address,address,uint256)"),
            ethers.utils.id("Deposited(address,address,uint256)"),
            ethers.utils.id("Withdrawn(address,address,uint256)"),
            ethers.utils.id("Rewarded(address,uint256)"),
        ]
    }

    const interface = new ethers.utils.Interface(
        ["event DirectDonation(address indexed sender, address indexed receiver, uint256 amount)",
        "event Deposited(address indexed sender, address indexed cTokenAddress, uint256 amount)",
        "event Withdrawn(address indexed sender, address indexed cTokenAddress, uint256 amount)",
        "event Rewarded(address indexed receiver, uint256 amount)"],
    );

    const eventListener = Web3LogListener(nodeUrl, eventFilter);

    eventListener.start(
        async (data) => {
            
            // console.log(data)
            
            // Check of the event comes from one of our contracts
            // Skip this event if the charity was not registered with our system
            const charityExists = await iHelp.hasCharity(data.address);
            if (!charityExists) {
                return;
            }
            handleEvent(interface.parseLog(data));
            
        },
        err => {
            console.log(err);
            process.exit(1);
        })

}

const handleEvent = async (event) => {
    console.log(event);
}

runListener()