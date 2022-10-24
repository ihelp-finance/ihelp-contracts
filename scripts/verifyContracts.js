const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const csv = require('csvtojson');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
const path = require('path')
var qs = require('qs');
var axios = require('axios');

const { getChainId, network } = require('hardhat');
const { red, chainName, green, yellow, dim, fromBigNumber, getLendingConfigurations, cyan,runRpcTest } = require("./deployUtils");

const proxyAbi = [{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[{"internalType":"contract TransparentUpgradeableProxy","name":"proxy","type":"address"},{"internalType":"address","name":"newAdmin","type":"address"}],"name":"changeProxyAdmin","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract TransparentUpgradeableProxy","name":"proxy","type":"address"}],"name":"getProxyAdmin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract TransparentUpgradeableProxy","name":"proxy","type":"address"}],"name":"getProxyImplementation","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract TransparentUpgradeableProxy","name":"proxy","type":"address"},{"internalType":"address","name":"implementation","type":"address"}],"name":"upgrade","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract TransparentUpgradeableProxy","name":"proxy","type":"address"},{"internalType":"address","name":"implementation","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"upgradeAndCall","outputs":[],"stateMutability":"payable","type":"function"}]

const verifyContracts = async() => {

    const nodeUrlWs = process.env.WEBSOCKET_RPC_URL;
    if (nodeUrlWs == '' || nodeUrlWs == undefined) {
        console.log('please define WEBSOCKET_RPC_URL env variable - exiting')
        process.exit(1)
    }
    
    const provider = new ethers.providers.WebSocketProvider(nodeUrlWs)
    
    let privKey = process.env.DEPLOYER_PRIVATE_KEY;
    const signer = new ethers.Wallet(privKey, provider);

    const proxyAddress = (await hardhat.deployments.get('DefaultProxyAdmin')).address;
    red('\nproxy',proxyAddress)
    proxy = new hardhat.ethers.Contract(proxyAddress, proxyAbi, signer);

    const contractsToVerify = {
      CharityPool: "CharityPool",
      iHelp: 'iHelpToken',
      analytics: 'Analytics',
      xHelp: 'xHelpToken',
      priceFeedProvider:'PriceFeedProvider',
      swapper:'Swapper',
      ContributionsAggregator:'ContributionsAggregator'
    };

    for (let i=0;i<Object.keys(contractsToVerify).length;i++) {

      await new Promise(resolve => setTimeout(resolve, 1000));

        const contract = Object.keys(contractsToVerify)[i];

        let implementation = null;

        contractFile = fs.readFileSync(`./deployments/${network.name}/${contract}_Implementation.json`,'utf8');
        contractData = JSON.parse(contractFile);
        implementation = contractData.address

        cyan('\n',contract,'->',implementation);

        // check if the contract is verified -> status=1
        var options = {
          'method': 'GET',
          'url': `https://api.snowtrace.io/api?module=contract&action=getabi&address=${implementation}&apikey=${process.env.BLOCKEXPLORER_API_KEY}`,
          'headers': {
          }
        };
        const verifyResponse = (await axios(options)).data

        let verified = false;
        if (verifyResponse['status'] == '1') {
          verified = true;
        }

        if (verified) {
          green('  implementation already verified - moving on...')
        } else {
          yellow('  implementation not verified - verifying contract now...')

          sourceCode = await fs.readFileSync(`contracts_flattened/${contractsToVerify[contract]}Flat.sol`,'utf8');

          let libs = [];

          if (contract == 'ContributionsAggregator') {
            const SwapperUtilsAddress = (await hardhat.deployments.get('SwapperUtils')).address;
            libs = [{
              name: 'SwapperUtils',
              address: SwapperUtilsAddress
            }]
          }

          var data = qs.stringify({
            'apikey': process.env.BLOCKEXPLORER_API_KEY,
            'action': 'verifysourcecode',
            'module': 'contract',
            'sourceCode': sourceCode,
            'contractaddress': implementation,
            'codeformat': 'solidity-single-file',
            'contractname': contractsToVerify[contract],
            'compilerversion': 'v0.8.10+commit.fc410830',
            'optimizationUsed': '1',
            'runs': '1000',
            'licenseType': '5' 
          });
          var config = {
            method: 'post',
            url: 'https://api.snowtrace.io/api',
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            data : data
          };
          //console.log(options)
          
          const verifySubmit = (await axios(config)).data
          console.log(verifySubmit)

          const verifyResult = verifySubmit['result'];
          // console.log('verifyResult',verifyResult)

          let verifyCount = 0;
          verifyStatusCheck = async(guid) =>{

            verifyCount+=1;
            
            var options = {
              'method': 'GET',
              'url': `https://api.snowtrace.io/api?guid=${guid}&apikey=${process.env.BLOCKEXPLORER_API_KEY}&module=contract&action=checkverifystatus`,
              'headers': {
              }
            };
            console.log(options)
            const status = (await  axios(options)).data
            console.log(status)

            if (status['message'] == 'OK') {
              green('  implementation is now verified...')
            } else {
              if (verifyCount < 10) {
                await setTimeout(async()=>{
                  await verifyStatusCheck(guid);
                },1000)
              } else {
                red('  cannot verify contract - please try again...')
              }
            }

          }

          if (verifyResult) {
            await verifyStatusCheck(verifyResult)
          }

        }
          
    }

    process.exit(0)

}

verifyContracts()