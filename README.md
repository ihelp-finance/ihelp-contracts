# iHelp Protocol Smart Contracts

| Statements                  | Functions                 | Lines             | Tests             |
| --------------------------- | ------------------------- | ----------------- | ----------------- |
| ![Statements](https://img.shields.io/badge/statements-93.25%25-brightgreen.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-89.27%25-yellow.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-93.15%25-brightgreen.svg?style=flat) | ![Tests](https://github.com/iHelp-Finance/ihelp-contracts/actions/workflows/unit-tests.yml/badge.svg) |

<em>Test Coverage Reports: <a href="https://ihelp-finance.github.io/ihelp-contracts/coverage" target="_blank">https://ihelp-finance.github.io/ihelp-contracts/coverage</a></em>

<em>Internal Audit Report: <a href="https://ihelp-finance.github.io/ihelp-contracts/audits/iHelpAuditReport.pdf" target="_blank">https://ihelp-finance.github.io/ihelp-contracts/audits/iHelpAuditReport.pdf</a></em>

[![node](https://img.shields.io/badge/node-16.x-brightgreen.svg)](https://nodejs.org/en/blog/release/v16.16.0/)

## Overview

iHelp is a non-custodial donation protocol where anyone (“Helpers”) can participate and easily contribute to charitable causes worldwide in novel ways. iHelp’s core initial donation mechanism is a no principal loss mechanism that allows Helpers to donate the interest generated by their capital. Helpers are also able to directly contribute principal to a charitable cause via a direct donation.

## Local Deployment

Install nvm and use node v16 for the current state of these contracts:
```
# curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
nvm install v16
nvm use v16
```

You can test the iHelp contracts with hardhat local development environment using the commands below:

```
yarn chain
```

```
yarn deploy
```

You can run through the extensive battery of tests (almost full coverage) using the command below:

```
# run the deploy command first on local chain so the e2e tests run properly
yarn test

# run a specific test with the command below
yarn test test/00_e2e-validation.test.js

```

## Event Listeners

We use event listeners to keep track of time-series-based on-chain events throughout the iHelp protocol. Start the listener after configuring your hardhat config (and running yarn chain if local) using the command below:

```
node scripts/eventListener.js
```

## Deployed Contracts

### iHelp (ERC20Upgradeable)

The primary Protocol ERC20 Upgradeable contract that drives HELP token issuance, phase control, contribution tracking, _dripping_ of HELP tokens based on latest aggregate contributions across all charities and finally _dumping_ the accumulated interest to the respective charity pools, swappers and staking/development pools.

### xHelp (ERC20Upgradeable)

Contributors to the iHelp Protocol are incrementally awarded HELP tokens based on the interest generated through the protocol (and ultimately donated to the charities of their choosing). These holders of HELP tokens can stake their HELP tokens and are provided xHELP in exchange. This  xHelp ERC20 Upgradable contract handles deposits, withdrawals and exchange of HELP to xHELP tokens and interacts directly with the iHelp contract for reward distribution.

### CharityPool

This is a primary custom contract developed to support charity contributions from ERC20 tokens (DAI, USDC, wETH, etc). This CharityPool contract is initialized for each specific charity wallet and specific holding token, and handles contribution, withdrawal, sending of the contributed tokens to the lending protocol selected for the charity pool, direct donation to the charity, and finally tracks the interest generated for each contributor by specify charity.  The CharityPool contract directly interacts with the iHelp and Swapper contracts when dripping the interest generated from the contributed token lending protocol.

### Swapper

The Swapper contract is specifically designed to handle exchanges from CharityPool contract tokens that do NOT match the underlying token of a specific exchange destination. For example, if a CharityPool is deployed as DAI pool, it is assumed the charity will receive their donation generated from interest / lending protocol will also be in DAI. Since the staking and developer pools for the iHelp Protocol are currently in DAI, no swapping is necessary in these situations. If the CharityPool is deployed as a USDC pool, the charity will receive their donation in USDC, but the Swapping contract is called before the staking and developer shares are sent to the DAI holding wallets.


## Off-Chain Processes

The below processes are currently running off-chain in the Rinkeby demo app. The team is considering moving several of these processes to on-chain [Chainlink keeper services](https://docs.chain.link/docs/chainlink-keepers/introduction/).

### Upkeep

The upkeep process specifically runs the _drip_ and _dump_ functions within the iHelp contract for 1) aggregating the total accumulated interest since the last upkeep, 2) circulating (or minting) new HELP tokens based on the total interested generated in accordance with the Distribution Phase map, 3) divides these newly circulated or minted HELP tokens to the contributors pro-rata their overall contributions, and 4) moves the generated incremental interest to a holding pool. This process runs at a cadence of once per day.

### Stat Collector

The stat collector process currently drives many of the leaderboard stats and collects data on the current state of the contracts, contributions, interest generation and overall numbers of contributors and deployed charities over time. Every one (1) minute the stat collector runs and updates an hourly aggregated value of the desired statistics. These stats are stored in an off-chain time-series database, and are served up with a REST API to the Dapp.

### Reward Distribution

The reward process is responsible for initiating the staking pool buyback of HELP tokens from the accumulated DAI in the staking pool. This process currently runs at a cadence of once every 3 days.


## Vulnerability Policy

Even with such priority and maximum effort, there is still the possibility that vulnerabilities can exist. In case you discover a vulnerability, we would like to know about it immediately so we can take steps to address it as quickly as possible.

If you discover a vulnerability, please do the following:

```
E-mail your findings to security@ihelp.finance 

Do not take advantage of the vulnerability or similar problems you have discovered, including, but not limited to, testing the vulnerability on the Ethereum mainnet or testnet. 

Do not reveal the vulnerability to others until it has been resolved, including, but not limited to, filing a public ticket mentioning the vulnerability. 

Do provide sufficient information to reproduce the vulnerability, so we will be able to resolve it as quickly as possible. Complex vulnerabilities may require further explanation so we might ask you for additional information. 
```
