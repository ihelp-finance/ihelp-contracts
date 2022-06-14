const ethers = require("ethers");
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
    const { abi } = require(process.env.IHELP_ABI_PATH);

    const provider = new ethers.providers.JsonRpcProvider(process.env.NODE_URL);
    const iHelp = new ethers.Contract(process.env.IHELP_ADDRESS, abi, provider);

    // Listen for all direct donation events on the connected chaon
    const donationsFilter = {
        topics: [
            ethers.utils.id("DirectDonation(address,address,uint256)")
        ]
    }

    const interface = new ethers.utils.Interface(
        ["event DirectDonation(address indexed sender, address indexed receiver, uint256 amount)"]
    );

    const eventListener = Web3LogListener(process.env.NODE_URL, donationsFilter);

    eventListener.start(
        async (data) => {
            
            // Check of the event comes from one of our contracts
            // Skip this event if the charity was not registered with our system
            const chairtyExists = await iHelp.hasCharity(data.address);
            if (!chairtyExists) {
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