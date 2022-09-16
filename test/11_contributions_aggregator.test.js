const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const AggregatorV3JSON = require("../artifacts/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json");

use(smock.matchers);

describe("Contributions aggregator", function () {
    let owner, charity, secondCharity, thirdCharity, devPool, stakingPool;
    let contributionsAggregator;
    let priceFeedProviderMock;
    let iHelpMock;
    let compoundConnector, aggregator;
    let lenderTokenUnderlyingMock, lenderTokenMock, holdingToken

    beforeEach(async function () {
        [owner, charity, secondCharity, thirdCharity, stakingPool, devPool, ...addrs] = await ethers.getSigners();

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
        iHelpMock.getFees.returns([100, 100, 800]);
        iHelpMock.getPools.returns([stakingPool.address, devPool.address]);


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

    describe('Interest', () => {
        beforeEach(async () => {
            await lenderTokenUnderlyingMock.mint(owner.address, 1000);
            await lenderTokenUnderlyingMock.increaseAllowance(contributionsAggregator.address, 1000);
            await contributionsAggregator.deposit(lenderTokenMock.address, charity.address, 1000);
        })

        it('should redeem interest', async () => {
            // We set holdingToken to be the same as the redeemed underlying to avoid swapping
            iHelpMock.underlyingToken.returns(lenderTokenUnderlyingMock.address);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            expect(await lenderTokenUnderlyingMock.balanceOf(devPool.address)).to.equal(10, "invalid total dev reward amount");
            expect(await lenderTokenUnderlyingMock.balanceOf(stakingPool.address)).to.equal(10, "invalid total staking reward amount");
            expect(await contributionsAggregator.currentRewards(lenderTokenMock.address)).to.equal(80, "invalid total charity reward amount");
        })

        it('should not redeem interest when yield is 0', async () => {
            // We set holdingToken to be the same as the redeemed underlying to avoid swapping
            iHelpMock.underlyingToken.returns(lenderTokenUnderlyingMock.address);

            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            expect(await lenderTokenUnderlyingMock.balanceOf(devPool.address)).to.equal(0, "invalid total dev reward amount");
            expect(await lenderTokenUnderlyingMock.balanceOf(stakingPool.address)).to.equal(0, "invalid total staking reward amount");
            expect(await contributionsAggregator.currentRewards(lenderTokenMock.address)).to.equal(0, "invalid total charity reward amount");
        })

    })

    describe('Charity Rewards', () => {
        beforeEach(async () => {
            iHelpMock.getFees.returns([0, 0, 1000]);

            await lenderTokenUnderlyingMock.mint(charity.address, 1000);
            await lenderTokenUnderlyingMock.connect(charity).increaseAllowance(contributionsAggregator.address, 1000);

            await lenderTokenUnderlyingMock.mint(secondCharity.address, 1000);
            await lenderTokenUnderlyingMock.connect(secondCharity).increaseAllowance(contributionsAggregator.address, 1000);

            await lenderTokenUnderlyingMock.mint(thirdCharity.address, 1000);
            await lenderTokenUnderlyingMock.connect(thirdCharity).increaseAllowance(contributionsAggregator.address, 1000);

            iHelpMock.underlyingToken.returns(lenderTokenUnderlyingMock.address);

        })

        it('should calculate the correct rewards', async () => {
            await contributionsAggregator.connect(charity).deposit(lenderTokenMock.address, charity.address, 1000);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(100);

            await contributionsAggregator.connect(secondCharity).deposit(lenderTokenMock.address, secondCharity.address, 1000);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(150);
            expect(await contributionsAggregator.claimableRewardOf(secondCharity.address, lenderTokenMock.address)).to.equal(50);

            await contributionsAggregator.connect(thirdCharity).deposit(lenderTokenMock.address, thirdCharity.address, 1000);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(183);
            expect(await contributionsAggregator.claimableRewardOf(secondCharity.address, lenderTokenMock.address)).to.equal(83);
            expect(await contributionsAggregator.claimableRewardOf(thirdCharity.address, lenderTokenMock.address)).to.equal(33);
        })

        it('should execute correct deposits and reward claims', async () => {
            await contributionsAggregator.connect(charity).deposit(lenderTokenMock.address, charity.address, 1000);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            await expect(contributionsAggregator.claimReward(charity.address, lenderTokenMock.address)).
                to.emit(lenderTokenUnderlyingMock, "Transfer").withArgs(contributionsAggregator.address, charity.address, 100);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(0);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            await contributionsAggregator.connect(secondCharity).deposit(lenderTokenMock.address, secondCharity.address, 1000);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            await expect(contributionsAggregator.claimReward(charity.address, lenderTokenMock.address)).
                to.emit(lenderTokenUnderlyingMock, "Transfer").withArgs(contributionsAggregator.address, charity.address, 150);

            await expect(contributionsAggregator.claimReward(secondCharity.address, lenderTokenMock.address)).
                to.emit(lenderTokenUnderlyingMock, "Transfer").withArgs(contributionsAggregator.address, secondCharity.address, 50);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(0);
            expect(await contributionsAggregator.claimableRewardOf(secondCharity.address, lenderTokenMock.address)).to.equal(0);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            await contributionsAggregator.connect(thirdCharity).deposit(lenderTokenMock.address, thirdCharity.address, 1000);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            await expect(contributionsAggregator.claimReward(charity.address, lenderTokenMock.address)).
                to.emit(lenderTokenUnderlyingMock, "Transfer").withArgs(contributionsAggregator.address, charity.address, 83);

            await expect(contributionsAggregator.claimReward(secondCharity.address, lenderTokenMock.address)).
                to.emit(lenderTokenUnderlyingMock, "Transfer").withArgs(contributionsAggregator.address, secondCharity.address, 83);

            await expect(contributionsAggregator.claimReward(thirdCharity.address, lenderTokenMock.address)).
                to.emit(lenderTokenUnderlyingMock, "Transfer").withArgs(contributionsAggregator.address, thirdCharity.address, 33);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(0);
            expect(await contributionsAggregator.claimableRewardOf(secondCharity.address, lenderTokenMock.address)).to.equal(0);
            expect(await contributionsAggregator.claimableRewardOf(thirdCharity.address, lenderTokenMock.address)).to.equal(0);
        })

        it('should calculate corrent rewards after withdraw', async () => {
            await contributionsAggregator.connect(charity).deposit(lenderTokenMock.address, charity.address, 1000);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            await contributionsAggregator.connect(charity).withdraw(lenderTokenMock.address, charity.address, 1000, owner.address);
            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(100);

            await expect(contributionsAggregator.claimReward(charity.address, lenderTokenMock.address)).
                to.emit(lenderTokenUnderlyingMock, "Transfer").withArgs(contributionsAggregator.address, charity.address, 100);
        })

        it('should execute correct deposits, withdrawals and reward claims', async () => {
            await contributionsAggregator.connect(charity).deposit(lenderTokenMock.address, charity.address, 1000);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            await contributionsAggregator.connect(secondCharity).deposit(lenderTokenMock.address, secondCharity.address, 1000);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(150);
            expect(await contributionsAggregator.claimableRewardOf(secondCharity.address, lenderTokenMock.address)).to.equal(50);

            await contributionsAggregator.connect(charity).withdraw(lenderTokenMock.address, charity.address, 1000, owner.address);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(150);
            expect(await contributionsAggregator.claimableRewardOf(secondCharity.address, lenderTokenMock.address)).to.equal(150);

            await contributionsAggregator.connect(thirdCharity).deposit(lenderTokenMock.address, thirdCharity.address, 1000);
            await contributionsAggregator.connect(secondCharity).withdraw(lenderTokenMock.address, secondCharity.address, 500, owner.address);

            await expect(contributionsAggregator.claimReward(charity.address, lenderTokenMock.address)).
                to.emit(lenderTokenUnderlyingMock, "Transfer").withArgs(contributionsAggregator.address, charity.address, 150);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(0);
            expect(await contributionsAggregator.claimableRewardOf(secondCharity.address, lenderTokenMock.address)).to.equal(183);
            expect(await contributionsAggregator.claimableRewardOf(thirdCharity.address, lenderTokenMock.address)).to.equal(66);

            await contributionsAggregator.connect(secondCharity).withdraw(lenderTokenMock.address, secondCharity.address, 500, owner.address);
            await contributionsAggregator.connect(thirdCharity).withdraw(lenderTokenMock.address, thirdCharity.address, 500, owner.address);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(0);
            expect(await contributionsAggregator.claimableRewardOf(secondCharity.address, lenderTokenMock.address)).to.equal(183);
            expect(await contributionsAggregator.claimableRewardOf(thirdCharity.address, lenderTokenMock.address)).to.equal(166);

            await contributionsAggregator.connect(thirdCharity).withdraw(lenderTokenMock.address, thirdCharity.address, 250, owner.address);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            await expect(contributionsAggregator.claimReward(secondCharity.address, lenderTokenMock.address)).
                to.emit(lenderTokenUnderlyingMock, "Transfer").withArgs(contributionsAggregator.address, secondCharity.address, 183);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(0);
            expect(await contributionsAggregator.claimableRewardOf(secondCharity.address, lenderTokenMock.address)).to.equal(0);
            expect(await contributionsAggregator.claimableRewardOf(thirdCharity.address, lenderTokenMock.address)).to.equal(266);

            await contributionsAggregator.connect(thirdCharity).withdraw(lenderTokenMock.address, thirdCharity.address, 250, owner.address);

            await lenderTokenMock.accrueCustom(100);
            await contributionsAggregator.redeemInterest(lenderTokenMock.address);

            expect(await contributionsAggregator.claimableRewardOf(charity.address, lenderTokenMock.address)).to.equal(0);
            expect(await contributionsAggregator.claimableRewardOf(secondCharity.address, lenderTokenMock.address)).to.equal(0);
            expect(await contributionsAggregator.claimableRewardOf(thirdCharity.address, lenderTokenMock.address)).to.equal(266);

            await expect(contributionsAggregator.claimReward(thirdCharity.address, lenderTokenMock.address)).
                to.emit(lenderTokenUnderlyingMock, "Transfer").withArgs(contributionsAggregator.address, thirdCharity.address, 266);
        })
    })
})