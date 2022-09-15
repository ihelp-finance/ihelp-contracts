const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const BigNumber = require('big.js');
const SwapperJSON = require("../artifacts/contracts/ihelp/Swapper.sol/Swapper.json");
const AggregatorV3JSON = require("../artifacts/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json");

const { yellow } = require("../scripts/deployUtils");
const { constants } = require('@openzeppelin/test-helpers');

use(smock.matchers);

describe("Contributions aggregator", function () {
    let owner, charity;
    let contributionsAggregator;
    let priceFeedProviderMock;
    let iHelpMock;
    let compoundConnector, aggregator;
    let lenderTokenUnderlyingMock, lenderTokenMock, holdingToken

    beforeEach(async function () {
        [owner, charity, ...addrs] = await ethers.getSigners();

        let SwapperUtils = await ethers.getContractFactory("SwapperUtils");
        SwapperUtils = await SwapperUtils.deploy();

        // ===== Intialize a Connector =====
        const ProtocolConnector = await smock.mock("CompoundConnector");
        compoundConnector = await ProtocolConnector.deploy();
        await compoundConnector.initialize();

        // ===== Intialize lender tokens =====
        const Mock = await smock.mock("ERC20MintableMock");
        const LenderTokenMock = await smock.mock("CTokenMock");
        holdingToken = await Mock.deploy("Holding", "HODL", 18);

        lenderTokenUnderlyingMock = await Mock.deploy("Mock", "MOK", 18);
        lenderTokenMock = await LenderTokenMock.deploy(lenderTokenUnderlyingMock.address, 1000);

        // ===== Intialize a PriceFeedProvider =====
        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
        priceFeedProviderMock = await PriceFeedProvider.deploy();

        aggregator = await smock.fake(AggregatorV3JSON.abi);
        aggregator.latestRoundData.returns([0, 1e9, 0, 0, 0]);

        await priceFeedProviderMock.initialize([{
            provider: "TestProvider",
            lendingAddress: lenderTokenMock.address,
            currency: "lenderTokenMock",
            underlyingToken: lenderTokenUnderlyingMock.address,
            priceFeed: aggregator.address,
            connector: compoundConnector.address
        }]);

        // ===== Intialize a iHelp Token  =====
        iHelpMock = await smock.fake("iHelpToken");
        iHelpMock.priceFeedProvider.returns(priceFeedProviderMock.address);
        iHelpMock.underlyingToken.returns(holdingToken.address);
        iHelpMock.hasCharity.returns(true);

        const ContributionsAggregator = await smock.mock("ContributionsAggregator", {
            libraries: {
                SwapperUtils: SwapperUtils.address
            }
        });

        contributionsAggregator = await ContributionsAggregator.deploy();
        await contributionsAggregator.initialize(iHelpMock.address);
    })

    describe('Deployment', function () {
        it('should deploy set the correct owner', async function () {
            const _owner = await contributionsAggregator.owner();
            expect(_owner).to.be.equal(owner.address)
        })

        it('should deploy set the correct iHelpToken reference', async function () {
            expect(await contributionsAggregator.ihelpToken()).to.be.equal(iHelpMock.address)
        })
    })

    describe('Getters', () => {
        it('should return to correct PriceFeedProvider', async () => {
            expect(await contributionsAggregator.priceFeedProvider()).to.be.equal(priceFeedProviderMock.address)
        })

        it('should return to correct HoldingToken', async () => {
            expect(await contributionsAggregator.holdingToken()).to.be.equal(holdingToken.address)
        })
    })

    describe('Deposit', () => {
        it('should process a deposit', async () => {
            await lenderTokenUnderlyingMock.mint(owner.address, 1000);
            await lenderTokenUnderlyingMock.increaseAllowance(contributionsAggregator.address, 1000);

            // Also checking for balance change
            await expect(() => contributionsAggregator.deposit(lenderTokenMock.address, charity.address, 1000))
                .to.changeTokenBalance(lenderTokenUnderlyingMock, owner, -1000);

            expect(await contributionsAggregator.accountedBalance(charity.address, lenderTokenMock.address)).to.equal(1000);
            expect(await contributionsAggregator.deposited(lenderTokenMock.address)).to.equal(1000);
            expect(await lenderTokenMock.balanceOf(contributionsAggregator.address)).to.equal(1000);
        })

        it('should fail to process a deposit on 0 amount', async () => {
            await expect(contributionsAggregator.deposit(lenderTokenMock.address, charity.address, 0)).to.be.revertedWith("Funding/deposit-zero");
        })

        it('should fail to process a deposit when lender token is not set', async () => {
            priceFeedProviderMock.hasDonationCurrency.returns(false);
            await expect(contributionsAggregator.deposit(lenderTokenMock.address, charity.address, 1000)).to.be.revertedWith("Funding/invalid-token");
        })

        it('should only allow charity contracts', async () => {
            iHelpMock.hasCharity.returns(false);
            await expect(contributionsAggregator.deposit(lenderTokenMock.address, charity.address, 1000)).to.be.revertedWith("Aggregator/not-allowed");
        })
    })

    describe('Withdraw', () => {
        beforeEach(async () => {
            await lenderTokenUnderlyingMock.mint(owner.address, 1000);
            await lenderTokenUnderlyingMock.increaseAllowance(contributionsAggregator.address, 1000);
            await contributionsAggregator.deposit(lenderTokenMock.address, charity.address, 1000);
        })

        it('should process a withdraw', async () => {
            await expect(() => contributionsAggregator.withdraw(lenderTokenMock.address, charity.address, 1000, owner.address))
                .to.changeTokenBalance(lenderTokenUnderlyingMock, owner, 1000);

            expect(await contributionsAggregator.accountedBalance(charity.address, lenderTokenMock.address)).to.equal(0);
            expect(await contributionsAggregator.deposited(lenderTokenMock.address)).to.equal(0);
            expect(await lenderTokenMock.balanceOf(contributionsAggregator.address)).to.equal(0);
        })

        it('should fail to process a withtraw on insufficient balance', async () => {
            await contributionsAggregator.withdraw(lenderTokenMock.address, charity.address, 1000, owner.address);
            expect(contributionsAggregator.withdraw(lenderTokenMock.address, charity.address, 1000, owner.address)).to.be.revertedWith("Funding/no-funds")
        })

        it('should only allow charity contracts', async () => {
            iHelpMock.hasCharity.returns(false);
            await expect(contributionsAggregator.withdraw(lenderTokenMock.address, charity.address, 1000, owner.address)).to.be.revertedWith("Aggregator/not-allowed");
        })
    })


})