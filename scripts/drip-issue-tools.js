const hardhat = require("hardhat");
const Big = require('big.js');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const fs = require('fs');
const chalk = require('chalk')
const ethers = require('ethers')
const axios = require('axios')


const jDAIaddress = '0xc988c170d0E38197DC634A45bF00169C7Aa7CA19';
const jDAIabi = [{ "inputs": [{ "internalType": "address", "name": "underlying_", "type": "address" }, { "internalType": "contract JoetrollerInterface", "name": "joetroller_", "type": "address" }, { "internalType": "contract InterestRateModel", "name": "interestRateModel_", "type": "address" }, { "internalType": "uint256", "name": "initialExchangeRateMantissa_", "type": "uint256" }, { "internalType": "string", "name": "name_", "type": "string" }, { "internalType": "string", "name": "symbol_", "type": "string" }, { "internalType": "uint8", "name": "decimals_", "type": "uint8" }, { "internalType": "address payable", "name": "admin_", "type": "address" }, { "internalType": "address", "name": "implementation_", "type": "address" }, { "internalType": "bytes", "name": "becomeImplementationData", "type": "bytes" }], "payable": false, "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "cashPrior", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "interestAccumulated", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "borrowIndex", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "totalBorrows", "type": "uint256" }], "name": "AccrueInterest", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "spender", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "borrower", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "borrowAmount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "accountBorrows", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "totalBorrows", "type": "uint256" }], "name": "Borrow", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "error", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "info", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "detail", "type": "uint256" }], "name": "Failure", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "receiver", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "totalFee", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "reservesFee", "type": "uint256" }], "name": "Flashloan", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "liquidator", "type": "address" }, { "indexed": false, "internalType": "address", "name": "borrower", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "repayAmount", "type": "uint256" }, { "indexed": false, "internalType": "address", "name": "jTokenCollateral", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "seizeTokens", "type": "uint256" }], "name": "LiquidateBorrow", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "minter", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "mintAmount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "mintTokens", "type": "uint256" }], "name": "Mint", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "oldAdmin", "type": "address" }, { "indexed": false, "internalType": "address", "name": "newAdmin", "type": "address" }], "name": "NewAdmin", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "token", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "newCap", "type": "uint256" }], "name": "NewCollateralCap", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "oldImplementation", "type": "address" }, { "indexed": false, "internalType": "address", "name": "newImplementation", "type": "address" }], "name": "NewImplementation", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "contract JoetrollerInterface", "name": "oldJoetroller", "type": "address" }, { "indexed": false, "internalType": "contract JoetrollerInterface", "name": "newJoetroller", "type": "address" }], "name": "NewJoetroller", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "contract InterestRateModel", "name": "oldInterestRateModel", "type": "address" }, { "indexed": false, "internalType": "contract InterestRateModel", "name": "newInterestRateModel", "type": "address" }], "name": "NewMarketInterestRateModel", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "oldPendingAdmin", "type": "address" }, { "indexed": false, "internalType": "address", "name": "newPendingAdmin", "type": "address" }], "name": "NewPendingAdmin", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "oldReserveFactorMantissa", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "newReserveFactorMantissa", "type": "uint256" }], "name": "NewReserveFactor", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "redeemer", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "redeemAmount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "redeemTokens", "type": "uint256" }], "name": "Redeem", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "payer", "type": "address" }, { "indexed": false, "internalType": "address", "name": "borrower", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "repayAmount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "accountBorrows", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "totalBorrows", "type": "uint256" }], "name": "RepayBorrow", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "benefactor", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "addAmount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "newTotalReserves", "type": "uint256" }], "name": "ReservesAdded", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "admin", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "reduceAmount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "newTotalReserves", "type": "uint256" }], "name": "ReservesReduced", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "Transfer", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "account", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "newCollateralTokens", "type": "uint256" }], "name": "UserCollateralChanged", "type": "event" }, { "payable": true, "stateMutability": "payable", "type": "fallback" }, { "constant": false, "inputs": [], "name": "_acceptAdmin", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "uint256", "name": "addAmount", "type": "uint256" }], "name": "_addReserves", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "uint256", "name": "reduceAmount", "type": "uint256" }], "name": "_reduceReserves", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "uint256", "name": "newCollateralCap", "type": "uint256" }], "name": "_setCollateralCap", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "implementation_", "type": "address" }, { "internalType": "bool", "name": "allowResign", "type": "bool" }, { "internalType": "bytes", "name": "becomeImplementationData", "type": "bytes" }], "name": "_setImplementation", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "contract InterestRateModel", "name": "newInterestRateModel", "type": "address" }], "name": "_setInterestRateModel", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "contract JoetrollerInterface", "name": "newJoetroller", "type": "address" }], "name": "_setJoetroller", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address payable", "name": "newPendingAdmin", "type": "address" }], "name": "_setPendingAdmin", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "uint256", "name": "newReserveFactorMantissa", "type": "uint256" }], "name": "_setReserveFactor", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "accountCollateralTokens", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "accrualBlockTimestamp", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [], "name": "accrueInterest", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "admin", "outputs": [{ "internalType": "address payable", "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "balanceOfUnderlying", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "uint256", "name": "borrowAmount", "type": "uint256" }], "name": "borrow", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "borrowBalanceCurrent", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "borrowBalanceStored", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "borrowIndex", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "borrowRatePerSecond", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "collateralCap", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "bytes", "name": "data", "type": "bytes" }], "name": "delegateToImplementation", "outputs": [{ "internalType": "bytes", "name": "", "type": "bytes" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [{ "internalType": "bytes", "name": "data", "type": "bytes" }], "name": "delegateToViewImplementation", "outputs": [{ "internalType": "bytes", "name": "", "type": "bytes" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [], "name": "exchangeRateCurrent", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "exchangeRateStored", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "flashFeeBips", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "contract ERC3156FlashBorrowerInterface", "name": "receiver", "type": "address" }, { "internalType": "address", "name": "initiator", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "bytes", "name": "data", "type": "bytes" }], "name": "flashLoan", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "getAccountSnapshot", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "getCash", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [], "name": "gulp", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "implementation", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "interestRateModel", "outputs": [{ "internalType": "contract InterestRateModel", "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "internalCash", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "isCollateralTokenInit", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "isJToken", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "joetroller", "outputs": [{ "internalType": "contract JoetrollerInterface", "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "borrower", "type": "address" }, { "internalType": "uint256", "name": "repayAmount", "type": "uint256" }, { "internalType": "contract JTokenInterface", "name": "jTokenCollateral", "type": "address" }], "name": "liquidateBorrow", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "uint256", "name": "mintAmount", "type": "uint256" }], "name": "mint", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "pendingAdmin", "outputs": [{ "internalType": "address payable", "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "uint256", "name": "redeemTokens", "type": "uint256" }], "name": "redeem", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "uint256", "name": "redeemAmount", "type": "uint256" }], "name": "redeemUnderlying", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "registerCollateral", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "uint256", "name": "repayAmount", "type": "uint256" }], "name": "repayBorrow", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "borrower", "type": "address" }, { "internalType": "uint256", "name": "repayAmount", "type": "uint256" }], "name": "repayBorrowBehalf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "reserveFactorMantissa", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "liquidator", "type": "address" }, { "internalType": "address", "name": "borrower", "type": "address" }, { "internalType": "uint256", "name": "seizeTokens", "type": "uint256" }], "name": "seize", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "supplyRatePerSecond", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "totalBorrows", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [], "name": "totalBorrowsCurrent", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "totalCollateralTokens", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "totalReserves", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "dst", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "src", "type": "address" }, { "internalType": "address", "name": "dst", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "underlying", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "unregisterCollateral", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }]

const path = require('path');
const { ifElse } = require('ramda');
require('dotenv').config({ path: path.resolve(__dirname, '../../env/.env') })

let signer;
let ihelp;

const fromBigNumber = (number) => {
    return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)))
}

function dim() {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.dim.call(chalk, ...arguments))
    }
}

function yellow() {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.yellow.call(chalk, ...arguments))
    }
}

function green() {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.green.call(chalk, ...arguments))
    }
}

function cyan() {
    if (!process.env.HIDE_DEPLOY_LOG) {
        console.log(chalk.cyan.call(chalk, ...arguments))
    }
}

const chainName = (chainId) => {
    switch (chainId) {
        case 1:
            return 'Mainnet';
        case 3:
            return 'Ropsten';
        case 4:
            return 'Rinkeby';
        case 5:
            return 'Goerli';
        case 42:
            return 'Kovan';
        case 56:
            return 'Binance Smart Chain';
        case 77:
            return 'POA Sokol';
        case 97:
            return 'Binance Smart Chain (testnet)';
        case 99:
            return 'POA';
        case 100:
            return 'xDai';
        case 137:
            return 'Matic';
        case 31337:
            return 'HardhatEVM';
        case 43113:
            return 'Fuji';
        case 43114:
            return 'Avalanche';
        case 80001:
            return 'Matic (Mumbai)';
        default:
            return 'Unknown';
    }
}

const leaderBoard = [
    {
        "address": "0x085290a16d2F9D9E4b2deF533617940386EeF54C",
        "name": "Matter",
        "contributions": 2100.089416,
        "donations": 0,
        "interests": 5.594921401747918,
        "createdAt": "2022-08-16T00:15:03.613Z",
        "updatedAt": "2022-08-26T18:09:05.744Z"
    },
    {
        "address": "0x7D69823fbaC34B25F42d6E0266AD9Ba211508bD7",
        "name": "Alzheimer's Disease and Related Disorders Association, Inc.",
        "contributions": 2000.14638,
        "donations": 0,
        "interests": 4.853218,
        "createdAt": "2022-08-18T01:27:04.057Z",
        "updatedAt": "2022-08-26T18:09:05.744Z"
    },
    {
        "address": "0xdb668cd91F7e25b7D354a925A65B3C6B7622E633",
        "name": "Big Dog Ranch Rescue",
        "contributions": 1514.8032502,
        "donations": 0,
        "interests": 0.46094917416940623,
        "createdAt": "2022-08-10T23:12:03.637Z",
        "updatedAt": "2022-08-27T09:33:05.812Z"
    },
    {
        "address": "0x830d33d0218248f72f728028BED6afAeA7D3D8f1",
        "name": "Think Together",
        "contributions": 1500.109785,
        "donations": 0,
        "interests": 4.160849,
        "createdAt": "2022-08-17T03:06:03.658Z",
        "updatedAt": "2022-08-26T18:09:05.743Z"
    },
    {
        "address": "0x32a0c06aB637FA0c7B7849CA82deC27459a19a20",
        "name": "Concern Worldwide US, Inc.",
        "contributions": 1500.109785,
        "donations": 0,
        "interests": 1.39807,
        "createdAt": "2022-08-18T01:21:03.882Z",
        "updatedAt": "2022-08-26T18:09:05.740Z"
    },
    {
        "address": "0x5789D5939782e1bb72E51A49C5EB7F2fa8e5c3c1",
        "name": "American Rivers, Inc.",
        "contributions": 1500.109785,
        "donations": 0,
        "interests": 2.180313,
        "createdAt": "2022-08-18T01:12:03.852Z",
        "updatedAt": "2022-08-26T18:09:05.742Z"
    },
    {
        "address": "0x6e679e9A073281dCca0fB7A929607607157C8d96",
        "name": "charity water",
        "contributions": 1452.623433957036,
        "donations": 0,
        "interests": 1.0824370576265228,
        "createdAt": "2022-08-18T21:21:04.026Z",
        "updatedAt": "2022-08-26T18:09:05.742Z"
    },
    {
        "address": "0x872b30f22AFDfA5E634130335180AD35e7F2dBEA",
        "name": "Fish & Wildlife Foundation of Florida, Inc.",
        "contributions": 1420.52396,
        "donations": 0,
        "interests": 2.062287,
        "createdAt": "2022-08-18T01:36:04.084Z",
        "updatedAt": "2022-08-26T18:09:05.742Z"
    },
    {
        "address": "0x3373e724edD4f5837Ad6570ba87BDF6801E583DC",
        "name": "Books for Africa, Inc.",
        "contributions": 1000.07319,
        "donations": 0,
        "interests": 1.762312,
        "createdAt": "2022-08-19T17:27:04.199Z",
        "updatedAt": "2022-08-26T18:09:05.743Z"
    },
    {
        "address": "0xf4d232DabDb83Eb05A87438C2491f0AFD2aaa5f5",
        "name": "St. Jude Children's Research Hospital",
        "contributions": 1000.07319,
        "donations": 0,
        "interests": 2.424884,
        "createdAt": "2022-08-18T01:33:04.223Z",
        "updatedAt": "2022-08-26T18:09:05.744Z"
    },
    {
        "address": "0x336292FC01D7cC942528DdCb8306B43BE1c4eE09",
        "name": "Channel One Food Bank",
        "contributions": 1000.07319,
        "donations": 0,
        "interests": 1.033082,
        "createdAt": "2022-08-17T03:12:03.717Z",
        "updatedAt": "2022-08-26T18:09:05.737Z"
    },
    {
        "address": "0xF48f4248885d879af2ab07bF19330122245D46Ed",
        "name": "Water for People",
        "contributions": 900.065871,
        "donations": 0,
        "interests": 0.92946,
        "createdAt": "2022-08-17T03:15:08.705Z",
        "updatedAt": "2022-08-26T18:09:05.738Z"
    },
    {
        "address": "0x4aF3D1AF431a67920BfE547ab2f7865aD022698a",
        "name": "Muttvile",
        "contributions": 641.046914,
        "donations": 0,
        "interests": 0.203265,
        "createdAt": "2022-08-23T19:39:05.586Z",
        "updatedAt": "2022-08-26T18:09:05.740Z"
    },
    {
        "address": "0xA6ED5f00d3501e4Ab35c9aab02255A78cD320FFC",
        "name": "Central Institute for the Deaf",
        "contributions": 500.036595,
        "donations": 0,
        "interests": 0.518089,
        "createdAt": "2022-08-17T02:45:03.709Z",
        "updatedAt": "2022-08-26T18:09:05.741Z"
    },
    {
        "address": "0xb58363bbBC5FBeB3Ddb11Bdf5862f694Ed7489AA",
        "name": "Wayside Waifs",
        "contributions": 420.030739,
        "donations": 0,
        "interests": 0.39117,
        "createdAt": "2022-08-18T01:30:04.029Z",
        "updatedAt": "2022-08-26T18:09:05.737Z"
    },
    {
        "address": "0x019171B8Ee9093e69851dAb4c7613B204e436695",
        "name": "Girls Who Code Inc",
        "contributions": 149.914554,
        "donations": 0,
        "interests": 0.10914436104715604,
        "createdAt": "2022-08-14T02:45:03.652Z",
        "updatedAt": "2022-08-26T18:09:05.743Z"
    },
    {
        "address": "0x08e6c17a0cC46506c3115e8472Bcd7dBd63841D3",
        "name": "The Relief Foundation",
        "contributions": 50.133500525,
        "donations": 0,
        "interests": 0.03935259362510167,
        "createdAt": "2022-08-10T07:34:22.714Z",
        "updatedAt": "2022-08-27T09:33:05.811Z"
    },
    {
        "address": "0xde745f23e3b41601263711866A799CEA4C6D2A27",
        "name": "Animal Friends Alliance",
        "contributions": 40.10680042,
        "donations": 0,
        "interests": 0.03181532270214969,
        "createdAt": "2022-08-10T08:54:03.454Z",
        "updatedAt": "2022-08-27T09:33:05.811Z"
    }
]

const testApy = async () => {

    // let {
    //     deployer
    // } = await hardhat.getNamedAccounts();

    // signer = await hardhat.ethers.provider.getSigner(deployer);
    // console.log('signer', signer._address);

    // const ihelpContract = (await hardhat.deployments.get('iHelp'));
    ihelp = await hardhat.ethers.getContractAt("iHelpToken", '0x500bd3Aaa7c785B07B45eAa09B4384D63A89b374');

    const priceFeedProvider = await ihelp.priceFeedProvider();
    // const connectorContract = (await hardhat.deployments.get('TraderJoeConnector'));
    const priceFeedInstance = await hardhat.ethers.getContractAt("PriceFeedProvider", priceFeedProvider);

    const charityInstance = await hardhat.ethers.getContractAt("CharityPool", '0xde745f23e3b41601263711866A799CEA4C6D2A27');

    const charities = await ihelp.getCharities();

    console.log("All charities", charities.length)

    const indexs = []

    leaderBoard.forEach(leaderb => {
        const index = charities.findIndex(item => item.toLowerCase() === leaderb.address.toLowerCase());
        indexs.push({ idx: index, address: leaderb.address })
    });

    // console.log(indexs.sort((a, b) => a.idx - b.idx).map((item, index) => ({ ...item, index })));

    // const lastCharityIndex = charities.findIndex(item => item.toLowerCase() === ('0xde745f23e3b41601263711866A799CEA4C6D2A27').toLowerCase());
    // const targteCharityIndex = charities.findIndex(item => item.toLowerCase() === ('0x872b30f22afdfa5e634130335180ad35e7f2dbea').toLowerCase());

    // console.log("last index", lastCharityIndex, "target", targteCharityIndex);
    // console.log("NAME", await charityInstance.name());
    const dTokens = await priceFeedInstance.getAllDonationCurrencies()
    console.log(dTokens.map(item => item.lendingAddress));

    console.log(dTokens);

    // const tjConnector = new hardhat.ethers.Contract(jDAIaddress, jDAIabi, hardhat.ethers.provider);

    // console.log('supplyRatePerSecond',fromBigNumber(await jDAI.supplyRatePerSecond()));

    // console.log(await tjConnector.supplyAPR(jDAIaddress,4000));

    process.exit(0)

}

testApy();
