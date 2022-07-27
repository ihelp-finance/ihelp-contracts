const hardhat = require("hardhat");
const Big = require('big.js');
const ethers = require('ethers')
const axios = require('axios')

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const { Web3LogListener } = require('./utils/wsLogs.ethers')

const genericErrorhandler = err => {
    console.log(err);
    process.exit(1);
}

process.on('uncaughtException', genericErrorhandler);
process.on('uncaughtExceptionMonitor', genericErrorhandler);
process.on('unhandledRejection', genericErrorhandler);

let iHelp = null;
let analytics = null;

// The listener configuration
const runListener = async () => {

    const ihelpContract = await hardhat.deployments.get('iHelp');
    const nodeUrl = hardhat.network.config.url;

    console.log(`Starting listener for ${hardhat.network.name} on ${nodeUrl}...`)

    const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    iHelp = new ethers.Contract(ihelpContract.address, ihelpContract.abi, provider);
    
    const analyticsContract = await hardhat.deployments.get('analytics');

    analytics = new ethers.Contract(analyticsContract.address, analyticsContract.abi, provider);

    // Listen for all charity events on the connected channel
    const eventFilters = [
        ethers.utils.id("DirectDonation(address,address,uint256)"),
        ethers.utils.id("Deposited(address,address,uint256)"),
        ethers.utils.id("Withdrawn(address,address,uint256)"),
        ethers.utils.id("Rewarded(address,uint256)"),
    ];

    const interface = new ethers.utils.Interface(
        ["event DirectDonation(address indexed sender, address indexed receiver, uint256 amount)",
            "event Deposited(address indexed sender, address indexed cTokenAddress, uint256 amount)",
            "event Withdrawn(address indexed sender, address indexed cTokenAddress, uint256 amount)",
            "event Rewarded(address indexed receiver, uint256 amount)"],
    );

    const eventListener = Web3LogListener(nodeUrl, eventFilters);

    eventListener.start(
        async (data) => {
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
    //console.log(event);
    
    // keep single event table
    const sEvent = {}
    
    if (event['name'] == 'Deposited' || event['name'] == 'Withdrawn') {
    
        sEvent['name'] = event['name']
        sEvent['sender'] = event['args']['sender']
        sEvent['lendingAddress'] = event['args']['cTokenAddress']
        
        // get supported currency array with prices to multiply currency by amount
        const currencies = await analytics.getSupportedCurrencies(iHelp.address)
        
        console.log(currencies)
        
        const currencyHash = {}
        currencies.map((c)=>{
            currencyHash[c['lendingAddress']] = c
        })
        
        // get currency and price from cTokenAddress == lendingAddress
        const selectedCurrency = currencyHash[sEvent['lendingAddress']]
        console.log('selectedCurrency',selectedCurrency)
        
        sEvent['currency'] = selectedCurrency['currency']
        sEvent['provider'] = selectedCurrency['provider']
        sEvent['underlyingToken'] = selectedCurrency['underlyingToken']

        sEvent['amount'] =  parseFloat(ethers.utils.formatUnits(event['args']['amount'], parseInt(selectedCurrency['decimals']) ));
        sEvent['price'] =  parseFloat(ethers.utils.formatUnits(selectedCurrency['price'], parseInt(selectedCurrency['priceDecimals']) ));
        
        console.log(sEvent['amount'])
        
        sEvent['amountUSD'] = sEvent['amount'] * sEvent['price'];
        
        if (sEvent['name'] == 'Withdrawn') {
            sEvent['amountUSD'] = -1*sEvent['amountUSD']
            sEvent['amount'] = -1*sEvent['amount']
        }
        
        const url = `https://dev.ihelp.finance/api/v1/data/event?key=${process.env.EVENT_API_KEY}`
        
        console.log(sEvent)
        
        axios.post(url, sEvent)
          .then(function (response) {
            console.log(response.data);
          })
          .catch(function (error) {
            console.log(error);
          });

    }
   
}

runListener()