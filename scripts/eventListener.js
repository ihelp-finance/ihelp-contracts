
const hardhat = require("hardhat");
const Big = require('big.js');
const ethers = require('ethers')
//const axios = require('axios')
const Web3 = require('web3');

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../env/.env') })

const db = require('../../ihelp-app/config/db.js');

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
const runListener = async() => {

    const nodeUrlWs = process.env.WEBSOCKET_RPC_URL;

    if (nodeUrlWs == '' || nodeUrlWs == undefined) {
        console.log('please define WEBSOCKET_RPC_URL env variable - exiting')
        process.exit(1)
    }

    // console.log(`Starting listener for ${hardhat.network.name} on ${nodeUrlWs}...`)

    const provider = new ethers.providers.WebSocketProvider(nodeUrlWs);
    
    const ihelpContract = await hardhat.deployments.get('iHelp');
    const analyticsContract = await hardhat.deployments.get('analytics');

    iHelp = new ethers.Contract(ihelpContract.address, ihelpContract.abi, provider);
    analytics = new ethers.Contract(analyticsContract.address, analyticsContract.abi, provider);

    // Connect
    // const options = {
    //     timeout: 30000, // ms
    
    //     clientConfig: {
    //         // Useful if requests are large
    //         maxReceivedFrameSize: 100000000,   // bytes - default: 1MiB
    //         maxReceivedMessageSize: 100000000, // bytes - default: 8MiB
    
    //         // Useful to keep a connection alive
    //         keepalive: true,
    //         keepaliveInterval: -1 // ms
    //     },
    
    //     // Enable auto reconnection
    //     reconnect: {
    //         auto: true,
    //         delay: 1000, // ms
    //         maxAttempts: 10,
    //         onTimeout: false
    //     }
    // };
    
    let providerWeb3, web3;
    providerWeb3 = new Web3.providers.WebsocketProvider(nodeUrlWs);
    web3 = new Web3(providerWeb3);

    // listen only from the latest block
    const currentBlock = await provider.getBlock("latest")

    // Listen for all charity events on the connected channel
    const eventFilters = [
        { name: 'donate', topic: ethers.utils.id("DirectDonation(address,address,uint256,string)"), iface: new ethers.utils.Interface(["event DirectDonation(address indexed sender, address indexed receiver, uint256 amount, string memory _memo)"]) },
        { name: 'deposit', topic: ethers.utils.id("Deposited(address,address,uint256,string)"), iface: new ethers.utils.Interface(["event Deposited(address indexed sender, address indexed cTokenAddress, uint256 amount, string memory _memo)"]) },
        { name: 'withdraw', topic: ethers.utils.id("Withdrawn(address,address,uint256)"), iface: new ethers.utils.Interface(["event Withdrawn(address indexed sender, address indexed cTokenAddress, uint256 amount)"]) },
        { name: 'reward', topic: ethers.utils.id("Rewarded(address,uint256)"), iface: new ethers.utils.Interface(["event Rewarded(address indexed receiver, uint256 amount)"]) },
    ];

    eventFilters.map((filter) => {

        let options = {
            fromBlock: currentBlock['number'] - 5,
            address: [],
            topics: [filter['topic']]
        };

        let subscription = web3.eth.subscribe('logs', options, (err, event) => {});

        subscription.on('data', log => {

            // console.log(log)

            const event = filter['iface'].parseLog(log)

            handleEvent(log['id'], event, log['address'])

        })

        // subscription.on('changed', changed => console.log('changed',filter['name'],changed))
        subscription.on('error', err => { console.log('err', filter['name'], err) })
        // subscription.on('connected', nr => console.log('connected', filter['name'], nr))

    })

}

const handleEvent = async(id, event, from) => {
    
    // console.log(event);

    // keep single event table
    const sEvent = {}

    if (event['name'] == 'Deposited' || event['name'] == 'Withdrawn') {

        sEvent['id'] = id

        const existingEntry = await db.Event.findOne({
            where: { id: sEvent['id'] }
        })
        
        if (existingEntry == null) {

            sEvent['name'] = event['name']
            sEvent['sender'] = event['args']['sender']
            sEvent['from'] = from
            sEvent['lendingAddress'] = event['args']['cTokenAddress']

            if (Object.keys(event['args']).indexOf('_memo') > -1) {
                if (event['args']['_memo'] != "") {
                    sEvent['memo'] = event['args']['_memo'];
                }
            }

            // get supported currency array with prices to multiply currency by amount
            const currencies = await analytics.getSupportedCurrencies(iHelp.address,process.env.NETWORK_BLOCK_TIME || 4000);

            const currencyHash = {}
            currencies.map((c) => {
                currencyHash[c['lendingAddress']] = c
            })

            // get currency and price from cTokenAddress == lendingAddress
            const selectedCurrency = currencyHash[sEvent['lendingAddress']]
            //console.log('selectedCurrency', selectedCurrency)

            sEvent['currency'] = selectedCurrency['currency']
            sEvent['provider'] = selectedCurrency['provider']
            sEvent['underlyingToken'] = selectedCurrency['underlyingToken']

            sEvent['amount'] = parseFloat(ethers.utils.formatUnits(event['args']['amount'], parseInt(selectedCurrency['decimals'])));
            sEvent['price'] = parseFloat(ethers.utils.formatUnits(selectedCurrency['price'], parseInt(selectedCurrency['priceDecimals'])));

            sEvent['amountUSD'] = sEvent['amount'] * sEvent['price'];

            if (sEvent['name'] == 'Withdrawn') {
                sEvent['amountUSD'] = -1 * sEvent['amountUSD']
                sEvent['amount'] = -1 * sEvent['amount']
            }
            console.log(sEvent)

            await db.Event.create(sEvent)
            
        }

        // const url = `https://dev.ihelp.finance/api/v1/data/event?key=${process.env.EVENT_API_KEY}`
        // axios.post(url, sEvent)
        //   .then(function (response) {
        //     console.log(response.data);
        //   })
        //   .catch(function (error) {
        //     console.log(error);
        //   });

    }

}

runListener()