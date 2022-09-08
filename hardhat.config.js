const { utils } = require("ethers");
const fs = require("fs");
const chalk = require("chalk");

const path = require('path')
require('dotenv').config({ path: process.env.ENV_PATH || '../env/.env' })

require("@nomiclabs/hardhat-waffle");
require("@tenderly/hardhat-tenderly");
require('@nomiclabs/hardhat-ethers');
require("solidity-coverage");
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("hardhat-deploy");
require("@eth-optimism/hardhat-ovm");
require('hardhat-preprocessor');

const { removeConsoleLog } = require('hardhat-preprocessor');
const { parseEther } = require('ethers/lib/utils');

const { isAddress, getAddress, formatUnits, parseUnits } = utils;

const defaultNetwork = process.env.REACT_APP_NETWORK || "localhost";

console.log('NETWORK:',defaultNetwork);

// OPTIONAL FLAG TO REMOVE LOG STATEMENTS FROM THE CONTRACTS
// can issue "npx hardhat flatten ./contracts/ihelp/iHelpToken.sol > iHelpTokenFlat.sol" to create single flatten source files for bytecode validation
let removeLogStatements = process.env.REMOVE_LOG_STATEMENTS || false;

let preprocessOptions = null;
if (removeLogStatements && removeLogStatements == 'true') {
  preprocessOptions = {
    eachLine: removeConsoleLog()
  };
}

// currently localhost requires a fork from rinkeby for liquidty pools for swapper
let forkingData = undefined;
if (process.env.TEST_FORK != '' && process.env.TEST_FORK != undefined) {
  forkingData = {
    url: process.env.TEST_FORK,
    // blockNumber: 19481997
  };
}

// signer accounts keys for transactions
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || new Array(64 + 1).join( '0' );
const reportGas = process.env.REPORT_GAS || false;

// gnosis-safe
const proxyAdminOwner = process.env.PROXY_ADMIN_OWNER;
const developmentPoolAddress = process.env.DEVELOPMENTPOOL_ADDRESS;

let localAccountData = {
  accountBalance: parseEther("1000000")
}
if (deployerPrivateKey != undefined && deployerPrivateKey != '' && deployerPrivateKey != new Array(64 + 1).join( '0' )) {
  localAccountData = [{
    privateKey:`0x${deployerPrivateKey}`, // deployer
    balance: "10000000000000000000000"
  }]
}

module.exports = {

  defaultNetwork,

  networks: {
    hardhat: {
      forking: forkingData,
      accounts: localAccountData,
      loggingEnabled: process.env.TEST_LOGGING == 'true' ? true : false,
      timeout: 1200000, // this is needed for forked chain timeouts and/or slow rpc endpoints
      networkCheckTimeout: 1200000,
      blockGasLimit: 8_000_000,
      // mining: {
      //   auto: false,
      //   interval: 1000
      // }
    },
    localhost: {
      url: process.env.REACT_APP_RPC_URL || "http://localhost:7545",
      forking: forkingData,
      loggingEnabled:process.env.TEST_LOGGING == 'true' ? true : false,
      timeout: 1200000, // this is needed for forked chain timeouts and/or slow rpc endpoints
      networkCheckTimeout: 1200000,
    },
    mainnet: {
      url: process.env.REACT_APP_RPC_URL || "",
      chainId: 1,
      accounts: [
        `0x${deployerPrivateKey}`, // deployer
      ]
    },
    rinkeby: {
      url: process.env.REACT_APP_RPC_URL || "",
      chainId: 4,
      accounts: [
        `0x${deployerPrivateKey}`, // deployer
      ]
    },
    kovan: {
      url: process.env.REACT_APP_RPC_URL || "",
      chainId: 42,
      accounts: [
        `0x${deployerPrivateKey}`, // deployer
      ]
    },
    avalanche: {
      url: process.env.REACT_APP_RPC_URL || "",
      chainId: 43114,
      accounts: [
        `0x${deployerPrivateKey}`, // deployer
      ]
    },
    fuji: {
      url: process.env.REACT_APP_RPC_URL || "",
      chainId: 43113,
      accounts: [
        `0x${deployerPrivateKey}`, // deployer
      ]
    }
  },
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      },
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    }
  },
  namedAccounts: {
    proxyAdmin: {
      default: proxyAdminOwner,
    },
    deployer: {
      default: 0,
    },
    developmentPool: {
      default: 0,
      43114: developmentPoolAddress, // gnosis-safe multi-sig
      42: developmentPoolAddress,
    },
    charity1wallet: {
      default: 2,
    },
    charity2wallet: {
      default: 3,
    },
    charity3wallet: {
      default: 4
    },
    charity4wallet: {
      default: 5
    },
    userAccount: {
      default: 6
    },
    userAccount1: {
      default: 7
    },
    userAccount2: {
      default: 8
    }
  },
  gasReporter: {
    enabled: reportGas,
    currency: 'USD',
    gasPrice: 30,
    excludeContracts: ["testing/"]
  },

  preprocess: preprocessOptions,
  mocha: {
    timeout: 100000000
  }

};

const DEBUG = false;

function debug(text) {
  if (DEBUG) {
    console.log(text);
  }
}

task("wallet", "Create a wallet (pk) link", async (_, { ethers }) => {
  const randomWallet = ethers.Wallet.createRandom();
  const privateKey = randomWallet._signingKey().privateKey;
  console.log("🔐 WALLET Generated as " + randomWallet.address + "");
  console.log("🔗 http://localhost:3000/pk#" + privateKey);
});

task("fundedwallet", "Create a wallet (pk) link and fund it with deployer?")
  .addOptionalParam(
    "amount",
    "Amount of ETH to send to wallet after generating"
  )
  .addOptionalParam("url", "URL to add pk to")
  .setAction(async (taskArgs, { network, ethers }) => {
    const randomWallet = ethers.Wallet.createRandom();
    const privateKey = randomWallet._signingKey().privateKey;
    console.log("🔐 WALLET Generated as " + randomWallet.address + "");
    let url = taskArgs.url ? taskArgs.url : "http://localhost:3000";

    let localDeployerMnemonic;
    try {
      localDeployerMnemonic = fs.readFileSync("./mnemonic.txt");
      localDeployerMnemonic = localDeployerMnemonic.toString().trim();
    }
    catch (e) {
      /* do nothing - this file isn't always there */
    }

    let amount = taskArgs.amount ? taskArgs.amount : "0.01";
    const tx = {
      to: randomWallet.address,
      value: ethers.utils.parseEther(amount),
    };

    //SEND USING LOCAL DEPLOYER MNEMONIC IF THERE IS ONE
    // IF NOT SEND USING LOCAL HARDHAT NODE:
    if (localDeployerMnemonic) {
      let deployerWallet = new ethers.Wallet.fromMnemonic(
        localDeployerMnemonic
      );
      deployerWallet = deployerWallet.connect(ethers.provider);
      console.log(
        "💵 Sending " +
        amount +
        " ETH to " +
        randomWallet.address +
        " using deployer account"
      );
      let sendresult = await deployerWallet.sendTransaction(tx);
      console.log("\n" + url + "/pk#" + privateKey + "\n");
      return;
    }
    else {
      console.log(
        "💵 Sending " +
        amount +
        " ETH to " +
        randomWallet.address +
        " using local node"
      );
      console.log("\n" + url + "/pk#" + privateKey + "\n");
      return send(ethers.provider.getSigner(), tx);
    }
  });

task(
  "generate",
  "Create a mnemonic for accounts")
  .addOptionalParam("num", "Number of accounts to generate.")
  .setAction(async (taskArgs, { network, ethers }) => {

    const num = taskArgs.num ? parseInt(taskArgs.num) : 1;

    for (let i =0; i < num; i++) {

      const bip39 = require("bip39");
      const hdkey = require("ethereumjs-wallet/hdkey");
      const mnemonic = bip39.generateMnemonic();
      if (DEBUG) console.log("mnemonic", mnemonic);
      const seed = await bip39.mnemonicToSeed(mnemonic);
      if (DEBUG) console.log("seed", seed);
      const hdwallet = hdkey.fromMasterSeed(seed);
      const wallet_hdpath = "m/44'/60'/0'/0/";
      const account_index = 0;
      let fullPath = wallet_hdpath + account_index;
      if (DEBUG) console.log("fullPath", fullPath);
      const wallet = hdwallet.derivePath(fullPath).getWallet();
      const privateKey = "0x" + wallet._privKey.toString("hex");
      if (DEBUG) console.log("privateKey", privateKey);
      var EthUtil = require("ethereumjs-util");
      const address =
        "0x" + EthUtil.privateToAddress(wallet._privKey).toString("hex");
      console.log(i+1,'/',num,address);

      const walletDir = './wallets';
      if (!fs.existsSync(walletDir)){
          fs.mkdirSync(walletDir, { recursive: true });
      }
  
      fs.writeFileSync(walletDir + "/" + address + ".txt", privateKey.toString());

    }

  }
);

task(
  "transferToWallets",
  "Transfer specific amount to wallet accounts.")
  .addOptionalParam("min", "Min amount to transfer")
  .addOptionalParam("max", "Min amount to transfer")
  .setAction(async (taskArgs, { getNamedAccounts,network, ethers,getChainId, deployments }) => {

      const hdkey = require("ethereumjs-wallet/hdkey");
      const bip39 = require("bip39");

      const chainId = await getChainId();

      let {
        deployer
      } = await getNamedAccounts();
    
      console.log('\n',deployer)
      signer = await ethers.provider.getSigner(deployer);

      const balance = await ethers.provider.getBalance(signer._address);
      console.log("   avax balance: " + ethers.utils.formatEther(balance));

      if (taskArgs.min != undefined && taskArgs.max != undefined) {

        const accounts = [];
        fs.readdirSync("wallets", "utf8").forEach((file) => {
          // accounts.push(fs.readFileSync("wallets/" + file, "utf8"));
          accounts.push(file.replace('.txt',''));
        });

        const native = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
        const currency = '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70';

        // swap avax to wavax
        const external_contracts = require('../ihelp-app/client/src/contracts/external_contracts');
        const wavaxabi= external_contracts[chainId]['contracts']['WAVAX']['abi'];
        
        const wrappedNative = new ethers.Contract(native, wavaxabi, signer);
        const dai = await ethers.getContractAt("ERC20", currency);

        const daibalance = await dai.balanceOf(signer._address);
        let wavaxbalance = await wrappedNative.balanceOf(signer._address);

        // use swapper to convert avax to dai
        const swapperAddress = (await deployments.get('swapper')).address;
        swapper = await ethers.getContractAt('Swapper', swapperAddress, signer);

        const WRAP_AVAX = false;
        const SWAP_TO_DAI = false;
        const DO_TRANSFERS = false;
        const DO_DONATIONS = false;

        if (WRAP_AVAX) {
          const nativeAmount = await swapper.getNativeRoutedTokenPrice(currency, native, ethers.utils.parseUnits('180',18));
          const wrapTx = await wrappedNative.deposit({value: nativeAmount });
          await wrapTx.wait();
        }    

        if (SWAP_TO_DAI) {

          wavaxbalance = await wrappedNative.balanceOf(signer._address);
          
          const currencyAmount = await swapper.getNativeRoutedTokenPrice(native, currency, wavaxbalance);
          const minamount = currencyAmount.mul(95).div(100);

          const approveTx = await wrappedNative.approve(swapperAddress, wavaxbalance);
          await approveTx.wait();

          const swapTx = await swapper.swap(native,currency,wavaxbalance.toString(), minamount, signer._address)
          await swapTx.wait();

        }

        console.log("   wavax balance: " + ethers.utils.formatEther(wavaxbalance));
        console.log("   dai balance: " + ethers.utils.formatEther(daibalance));

        console.log('\n',accounts.length,'accounts found...\n');

        let totalTransfered = 0;
        let totalDonated = 0;

        let deployedCharities = [];
        if (DO_DONATIONS) {
          const FILE_DIR = 'build'
          const FILE_PATH = path.join(FILE_DIR, `${defaultNetwork}_charities.json`);
          if (fs.existsSync(FILE_PATH)) {
            const fileData = fs.readFileSync(FILE_PATH, { encoding: 'utf-8' });
            deployedCharities = JSON.parse(fileData);
          }
        }

        for (let a in accounts) {

          let userbalance = await ethers.provider.getBalance(accounts[a]);
          let daibalance = await dai.balanceOf(accounts[a]);
          console.log(parseInt(a)+1,'/',accounts.length,accounts[a],'avax:'+ethers.utils.formatEther(userbalance),'dai:'+ethers.utils.formatEther(daibalance));

          if (DO_TRANSFERS) {
            const amountToTransfer = Math.random() * (parseFloat(taskArgs.max) - parseFloat(taskArgs.min)) + parseFloat(taskArgs.min);
            console.log('   transferring',amountToTransfer);
            const transferTx = await dai.transfer(accounts[a],ethers.utils.parseUnits(amountToTransfer.toString(),18));
            await transferTx.wait();
            daibalance = await dai.balanceOf(accounts[a]);
            console.log('   newbalance',ethers.utils.formatEther(daibalance));
            totalTransfered+=amountToTransfer;
          }

          if (DO_DONATIONS && daibalance > 0) {

            const rndInt = Math.floor(Math.random() * deployedCharities.length);
            const charity = deployedCharities[rndInt];

            console.log('   donating',ethers.utils.formatEther(daibalance),'to',charity.charityName);

            const walletFile = `./wallets/${accounts[a]}.txt`;

            let privKey = fs.readFileSync(walletFile).toString().trim();
            const userSigner = new ethers.Wallet(privKey, ethers.provider);

            if (userbalance == 0) {

              const txAmount = 0.02;

              console.log('   transfering',txAmount,'avax to user...');
              const txRequest = {
                from: signer._address,
                to: userSigner.address,
                value: ethers.utils.parseUnits(txAmount.toString(), "ether").toHexString(),
                chainId: chainId,
              };

              const transferTx = await send(signer, txRequest);
              await transferTx.wait()

              userbalance = await ethers.provider.getBalance(userSigner.address);
              console.log("   new user avax balance: " + ethers.utils.formatEther(userbalance));

            }

            const approveTx = await dai.connect(userSigner).approve(charity.address, daibalance.toString());
            await approveTx.wait();

            const charityInstance = await ethers.getContractAt("CharityPool", charity.address);

            const lender = '0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE';
            const donateTx = await charityInstance.connect(userSigner).depositTokens(lender,daibalance.toString(),"");
            await donateTx.wait();

            const donationbalance = await charityInstance.balanceOf(userSigner.address,lender);
            console.log('   donationbalance',parseFloat(ethers.utils.formatEther(donationbalance)));
            
            userbalance = await ethers.provider.getBalance(userSigner.address);
            console.log("   user avax balance: " + ethers.utils.formatEther(userbalance));

            totalDonated+=parseFloat(ethers.utils.formatEther(donationbalance));

            // process.exit(0)

          }

        }
        
        if (DO_TRANSFERS) {
          console.log('\ntotalTransfered',totalTransfered);
        }
        if (DO_DONATIONS) {
          console.log('\ntotalDonated',totalDonated);
        }

      }

  })


task(
  "account",
  "Get balance informations for the deployment account.")
  .addOptionalParam("address", "Address to lookup")
  .setAction(async (taskArgs, { getNamedAccounts,network, ethers }) => {

    let walletFile = taskArgs.address ? './wallets/' + taskArgs.address + '.txt' : false;

    if (walletFile == false) {

      let {
        deployer
      } = await getNamedAccounts();
    
      console.log(deployer)
      signer = await ethers.provider.getSigner(deployer);

      const balance = await ethers.provider.getBalance(signer._address);
      console.log("   balance: " + ethers.utils.formatEther(balance));


    } else {

      const hdkey = require("ethereumjs-wallet/hdkey");
      const bip39 = require("bip39");
      let mnemonic = fs.readFileSync(walletFile).toString().trim();
      if (DEBUG) console.log("mnemonic", mnemonic);
      const seed = await bip39.mnemonicToSeed(mnemonic);
      if (DEBUG) console.log("seed", seed);
      const hdwallet = hdkey.fromMasterSeed(seed);
      const wallet_hdpath = "m/44'/60'/0'/0/";
      const account_index = 0;
      let fullPath = wallet_hdpath + account_index;
      if (DEBUG) console.log("fullPath", fullPath);
      const wallet = hdwallet.derivePath(fullPath).getWallet();
      const privateKey = "0x" + wallet._privKey.toString("hex");
      if (DEBUG) console.log("privateKey", privateKey);
      var EthUtil = require("ethereumjs-util");
      const address =
        "0x" + EthUtil.privateToAddress(wallet._privKey).toString("hex");

      var qrcode = require("qrcode-terminal");
      qrcode.generate(address);

      const networks = {} // config.networks
      networks[defaultNetwork] = config.networks[defaultNetwork]

      for (let n in networks) {
        //console.log(config.networks[n],n)
        try {
          let provider = new ethers.providers.JsonRpcProvider(
            config.networks[n].url
          );
          let balance = await provider.getBalance(address);
          //console.log(" -- " + n + " -- ");
          console.log("   balance: " + ethers.utils.formatEther(balance));
          // console.log(
          //   "   nonce: " + (await provider.getTransactionCount(address))
          // );
        }
        catch (e) {
          if (DEBUG) {
            console.log(e);
          }
        }
      }

    }

  }
);

task(
  "mineContractAddress",
  "Looks for a deployer account that will give leading zeros"
)
  .addParam("searchFor", "String to search for")
  .setAction(async (taskArgs, { network, ethers }) => {
    let contract_address = "";
    let address;

    const bip39 = require("bip39");
    const hdkey = require("ethereumjs-wallet/hdkey");

    let mnemonic = "";
    while (contract_address.indexOf(taskArgs.searchFor) != 0) {
      mnemonic = bip39.generateMnemonic();
      if (DEBUG) console.log("mnemonic", mnemonic);
      const seed = await bip39.mnemonicToSeed(mnemonic);
      if (DEBUG) console.log("seed", seed);
      const hdwallet = hdkey.fromMasterSeed(seed);
      const wallet_hdpath = "m/44'/60'/0'/0/";
      const account_index = 0;
      let fullPath = wallet_hdpath + account_index;
      if (DEBUG) console.log("fullPath", fullPath);
      const wallet = hdwallet.derivePath(fullPath).getWallet();
      const privateKey = "0x" + wallet._privKey.toString("hex");
      if (DEBUG) console.log("privateKey", privateKey);
      var EthUtil = require("ethereumjs-util");
      address =
        "0x" + EthUtil.privateToAddress(wallet._privKey).toString("hex");

      const rlp = require("rlp");
      const keccak = require("keccak");

      let nonce = 0x00; //The nonce must be a hex literal!
      let sender = address;

      let input_arr = [sender, nonce];
      let rlp_encoded = rlp.encode(input_arr);

      let contract_address_long = keccak("keccak256")
        .update(rlp_encoded)
        .digest("hex");

      contract_address = contract_address_long.substring(24); //Trim the first 24 characters.
    }

    console.log(
      "⛏  Account Mined as " +
      address +
      " and set as mnemonic in packages/hardhat"
    );
    console.log(
      "📜 This will create the first contract: " +
      chalk.magenta("0x" + contract_address)
    );
    console.log(
      "💬 Use 'yarn run account' to get more information about the deployment account."
    );

    fs.writeFileSync(
      "./" + address + "_produces" + contract_address + ".txt",
      mnemonic.toString()
    );
    fs.writeFileSync("./mnemonic.txt", mnemonic.toString());
  });

async function addr(ethers, addr) {
  if (isAddress(addr)) {
    return getAddress(addr);
  }
  const accounts = await ethers.provider.listAccounts();
  if (accounts[addr] !== undefined) {
    return accounts[addr];
  }
  throw `Could not normalize address: ${addr}`;
}

task("accounts", "Prints the list of accounts", async (_, { ethers }) => {
  // const accounts = await ethers.provider.listAccounts();
  // accounts.forEach((account) => console.log(account));

  let provider = new ethers.providers.JsonRpcProvider(config.networks[defaultNetwork].url);

  const accounts = [];
  fs.readdirSync("wallets", "utf8").forEach((file) => {
    // accounts.push(fs.readFileSync("wallets/" + file, "utf8"));
    accounts.push(file.replace('.txt',''));
  });
  console.log(accounts.length,'accounts found...');
  for (let a in accounts) {
    let balance = await provider.getBalance(accounts[a]);
    console.log(accounts[a]+' '+ethers.utils.formatEther(balance));
  }

});

task("blockNumber", "Prints the block number", async (_, { ethers }) => {
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log(blockNumber);
});

task("balance", "Prints an account's balance")
  .addPositionalParam("account", "The account's address")
  .setAction(async (taskArgs, { ethers }) => {
    const balance = await ethers.provider.getBalance(
      await addr(ethers, taskArgs.account)
    );
    console.log(formatUnits(balance, "ether"), "ETH");
  });

function send(signer, txparams) {
  return signer.sendTransaction(txparams, (error, transactionHash) => {
    if (error) {
      debug(`Error: ${error}`);
    }
    debug(`transactionHash: ${transactionHash}`);
    // checkForReceipt(2, params, transactionHash, resolve)
  });
}

task("snapshot").setAction(async () => {
  const id = await hre.network.provider.request({
    method: "evm_snapshot",
  });
  debug(`Snapshotid: ${id}`);
});

task("revert")
  .addParam("id", "Snapshot id").setAction(async (taskArgs) => {
    await hre.network.provider.request({
      method: "evm_revert",
      params: [taskArgs.id]
    });

    const newId = await hre.network.provider.request({
      method: "evm_snapshot",
    });
    debug(`New Snapshotid: ${newId}`);
  });


task("send", "Send ETH")
  .addParam("from", "From address or account index")
  .addOptionalParam("to", "To address or account index")
  .addOptionalParam("amount", "Amount to send in ether")
  .addOptionalParam("data", "Data included in transaction")
  .addOptionalParam("gasPrice", "Price you are willing to pay in gwei")
  .addOptionalParam("gasLimit", "Limit of how much gas to spend")

  .setAction(async (taskArgs, { network, ethers }) => {
    const from = await addr(ethers, taskArgs.from);
    debug(`Normalized from address: ${from}`);
    const fromSigner = await ethers.provider.getSigner(from);

    let to;
    if (taskArgs.to) {
      to = await addr(ethers, taskArgs.to);
      debug(`Normalized to address: ${to}`);
    }

    const txRequest = {
      from: await fromSigner.getAddress(),
      to,
      value: parseUnits(
        taskArgs.amount ? taskArgs.amount : "0",
        "ether"
      ).toHexString(),
      nonce: await fromSigner.getTransactionCount(),
      gasPrice: parseUnits(
        taskArgs.gasPrice ? taskArgs.gasPrice : "1.001",
        "gwei"
      ).toHexString(),
      gasLimit: taskArgs.gasLimit ? taskArgs.gasLimit : 24000,
      chainId: network.config.chainId,
    };

    if (taskArgs.data !== undefined) {
      txRequest.data = taskArgs.data;
      debug(`Adding data to payload: ${txRequest.data}`);
    }
    debug(txRequest.gasPrice / 1000000000 + " gwei");
    debug(JSON.stringify(txRequest, null, 2));

    return send(fromSigner, txRequest);
  });


function getSortedFiles(dependenciesGraph) {
    const tsort = require("tsort")
    const graph = tsort()

    const filesMap = {}
    const resolvedFiles = dependenciesGraph.getResolvedFiles()
    resolvedFiles.forEach((f) => (filesMap[f.sourceName] = f))

    for (const [from, deps] of dependenciesGraph.entries()) {
        for (const to of deps) {
            graph.add(to.sourceName, from.sourceName)
        }
    }

    const topologicalSortedNames = graph.sort()

    // If an entry has no dependency it won't be included in the graph, so we
    // add them and then dedup the array
    const withEntries = topologicalSortedNames.concat(resolvedFiles.map((f) => f.sourceName))

    const sortedNames = [...new Set(withEntries)]
    return sortedNames.map((n) => filesMap[n])
}

function getFileWithoutImports(resolvedFile) {
    const IMPORT_SOLIDITY_REGEX = /^\s*import(\s+)[\s\S]*?;\s*$/gm

    return resolvedFile.content.rawContent.replace(IMPORT_SOLIDITY_REGEX, "").trim()
}

subtask("flat:get-flattened-sources", "Returns all contracts and their dependencies flattened")
    .addOptionalParam("files", undefined, undefined, types.any)
    .addOptionalParam("output", undefined, undefined, types.string)
    .setAction(async ({ files, output }, { run }) => {
        const dependencyGraph = await run("flat:get-dependency-graph", { files })
        //console.log(dependencyGraph)

        let flattened = ""

        if (dependencyGraph.getResolvedFiles().length === 0) {
            return flattened
        }

        const sortedFiles = getSortedFiles(dependencyGraph)

        let isFirst = true
        for (const file of sortedFiles) {
            if (!isFirst) {
                flattened += "\n"
            }
            flattened += `// File ${file.getVersionedName()}\n`
            flattened += `${getFileWithoutImports(file)}\n`

            isFirst = false
        }

        // Remove every line started with "// SPDX-License-Identifier:"
        flattened = flattened.replace(/SPDX-License-Identifier:/gm, "License-Identifier:")

        flattened = `// SPDX-License-Identifier: GPL-3.0\n\n${flattened}`

        // Remove every line started with "pragma experimental ABIEncoderV2;" except the first one
        flattened = flattened.replace(/pragma experimental ABIEncoderV2;\n/gm, ((i) => (m) => (!i++ ? m : ""))(0))

        flattened = flattened.trim()
        if (output) {
            console.log("Writing to", output)
            fs.writeFileSync(output, flattened)
            return ""
        }
        return flattened
    })

subtask("flat:get-dependency-graph")
    .addOptionalParam("files", undefined, undefined, types.any)
    .setAction(async ({ files }, { run }) => {
        const sourcePaths = files === undefined ? await run("compile:solidity:get-source-paths") : files.map((f) => fs.realpathSync(f))

        const sourceNames = await run("compile:solidity:get-source-names", {
            sourcePaths,
        })

        const dependencyGraph = await run("compile:solidity:get-dependency-graph", { sourceNames })

        return dependencyGraph
    })

task("flat", "Flattens and prints contracts and their dependencies")
    .addOptionalVariadicPositionalParam("files", "The files to flatten", undefined, types.inputFile)
    .addOptionalParam("output", "Specify the output file", undefined, types.string)
    .setAction(async ({ files, output }, { run }) => {
        console.log(
            await run("flat:get-flattened-sources", {
                files,
                output,
            })
        )
    })
