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
    blockNumber: 19247352
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

const DEBUG = true;

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
  "Create a mnemonic for builder deploys",
  async (_, { ethers }) => {
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
    console.log(
      "🔐 Account Generated as " +
      address +
      " and set as mnemonic in packages/hardhat"
    );
    console.log(
      "💬 Use 'yarn run account' to get more information about the deployment account."
    );

    fs.writeFileSync("./" + address + ".txt", mnemonic.toString());
    fs.writeFileSync("./mnemonic.txt", mnemonic.toString());
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

task(
  "account",
  "Get balance informations for the deployment account.",
  async (_, { ethers }) => {
    const hdkey = require("ethereumjs-wallet/hdkey");
    const bip39 = require("bip39");
    let mnemonic = fs.readFileSync("./mnemonic.txt").toString().trim();
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
    console.log("‍📬 Deployer Account is " + address);
    for (let n in config.networks) {
      //console.log(config.networks[n],n)
      try {
        let provider = new ethers.providers.JsonRpcProvider(
          config.networks[n].url
        );
        let balance = await provider.getBalance(address);
        console.log(" -- " + n + " --  -- -- 📡 ");
        console.log("   balance: " + ethers.utils.formatEther(balance));
        console.log(
          "   nonce: " + (await provider.getTransactionCount(address))
        );
      }
      catch (e) {
        if (DEBUG) {
          console.log(e);
        }
      }
    }
  }
);

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
  const accounts = await ethers.provider.listAccounts();
  accounts.forEach((account) => console.log(account));
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
