const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { smock } = require("@defi-wonderland/smock");
const { abi } = require("../artifacts/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json");
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
use(smock.matchers);

describe("Charity Pool", function () {
    let charityPool;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let stakingPool, developmentPool, iHelpMock, holdingMock;
    // Wrapped token mock∏
    let wTokenMock;
    // Aave token pool mock
    let aTokenPoolMock, aTokenMock, aUnderlyingTokenMock;
    // Compound Token Mock
    let CTokenMock, cTokenMock, cTokenUnderlyingMock;
    // TraderJoe Token Mock
    let TJTokenMock, tjTokenMock, tjTokenUnderlyingMock;

    let Mock;
    let swapperMock;
    let priceFeedProviderMock, aggregator;
    let CompoundConnector, AAVEConnector, TraderJoeConnector;
    let contributionsAggregator;

    beforeEach(async function () {

        [owner, addr1, addr2, stakingPool, developmentPool, holdingPool, operator, swapperPool, charityWallet, ...addrs] = await ethers.getSigners();
        Mock = await smock.mock("ERC20MintableMock");
        const WMock = await ethers.getContractFactory("WTokenMock");
        wTokenMock = await WMock.deploy();
        holdingMock = await Mock.deploy("Mock", "MOK", 9);

        // ======= Initialize Compound ============
        CTokenMock = await smock.mock("CTokenMock");
        cTokenUnderlyingMock = await Mock.deploy("Mock", "MOK", 18);
        cTokenMock = await CTokenMock.deploy(cTokenUnderlyingMock.address, 1000);

        let ProtocolConnector = await smock.mock("CompoundConnector");
        CompoundConnector = await ProtocolConnector.deploy();
        await CompoundConnector.initialize();
        // =========================================


        // ======== Initialize TradeJoe ============
        TJTokenMock = await smock.mock("TJTokenMock");
        tjTokenUnderlyingMock = await Mock.deploy("Mock", "MOK", 18);
        tjTokenMock = await TJTokenMock.deploy(tjTokenUnderlyingMock.address, 1000);

        ProtocolConnector = await smock.mock("TraderJoeConnector");
        TraderJoeConnector = await ProtocolConnector.deploy();
        await TraderJoeConnector.initialize();
        // =========================================

        // ======= Initialize AAVE =======
        const AToken = await smock.mock("ATokenMock");
        const APool = await smock.mock("APoolMock");

        aTokenPoolMock = await APool.deploy();
        aUnderlyingTokenMock = await Mock.deploy("aUnderlyingTokenMock", "AUMOCK", 6);
        aTokenMock = await AToken.deploy(aTokenPoolMock.address);

        await aTokenMock.initialize(
            aTokenPoolMock.address,
            addrs[6].address,
            aUnderlyingTokenMock.address,
            ZERO_ADDRESS,
            6,
            "aTokenMock",
            "ATKNM",
            Buffer.from("0")
        );

        await aTokenPoolMock.setAToken(aTokenMock.address);

        ProtocolConnector = await smock.mock("AAVEConnector");
        AAVEConnector = await ProtocolConnector.deploy();
        await AAVEConnector.initialize();
        // =========================================


        //  ======= Initialize IHelp ===============
        iHelpMock = await smock.fake("iHelpToken");
        iHelpMock.stakingPool.returns(stakingPool.address);
        iHelpMock.developmentPool.returns(developmentPool.address);
        iHelpMock.hasCharity.returns(true);
        iHelpMock.underlyingToken.returns(holdingMock.address);

        iHelpMock.getPools.returns([developmentPool.address, stakingPool.address]);
        // =========================================


        //  ======= Initialize Swappers Items =======
        let SwapperUtils = await ethers.getContractFactory("SwapperUtils");
        SwapperUtils = await SwapperUtils.deploy();

        swapperMock = await smock.fake("Swapper", { address: swapperPool.address });
        // =========================================


        //  ======= Initialize Contributions Aggregator =======
        const ContributionsAggregator = await smock.mock("ContributionsAggregatorExtended", {
            libraries: {
                SwapperUtils: SwapperUtils.address
            }
        });

        contributionsAggregator = await ContributionsAggregator.deploy();
        await contributionsAggregator.initialize(iHelpMock.address, swapperMock.address);

        iHelpMock.contributionsAggregator.returns(contributionsAggregator.address);
        // =========================================


        //  ======= Initialize Charity Pool =======
        aggregator = await smock.fake(abi);
        aggregator.latestRoundData.returns([0, 1e9, 0, 0, 0]);

        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
        priceFeedProviderMock = await PriceFeedProvider.deploy();

        holdingMock = await Mock.deploy("Mock", "MOK", 9);

        const CharityPool = await smock.mock("CharityPool2");
        charityPool = await CharityPool.deploy();

        await charityPool.initialize({
            charityName: "TestCharity",
            operatorAddress: operator.address,
            charityWalletAddress: charityWallet.address,// address _charityWallet,
            holdingTokenAddress: holdingMock.address, //_holdingToken,
            ihelpAddress: iHelpMock.address,
            swapperAddress: swapperMock.address,
            wrappedNativeAddress: wTokenMock.address,
            priceFeedProvider: priceFeedProviderMock.address
        });

        await priceFeedProviderMock.initialize([{
            provider: "CompoundProvider",
            lendingAddress: cTokenMock.address,
            currency: "CTokenMock",
            underlyingToken: cTokenUnderlyingMock.address,
            priceFeed: aggregator.address,
            connector: CompoundConnector.address
        }, {
            provider: "TraderJoeProvider",
            lendingAddress: tjTokenMock.address,
            currency: "TJokenMock",
            underlyingToken: tjTokenUnderlyingMock.address,
            priceFeed: aggregator.address,
            connector: TraderJoeConnector.address

        },
        {
            provider: "AAVEProvider",
            lendingAddress: aTokenMock.address,
            currency: "AAVETokenMock",
            underlyingToken: aUnderlyingTokenMock.address,
            priceFeed: aggregator.address,
            connector: AAVEConnector.address
        }
        ]);

        swapperMock.nativeToken.returns(wTokenMock.address);
        swapperMock.getAmountsOutByPath.returns(arg => arg[1] * 1e9);
        iHelpMock.priceFeedProvider.returns(priceFeedProviderMock.address);

    });

    describe("Test Migration", function () {
        const AMOUNT = 1000;
        const distributeTokens = async (token, uToken, to) => {
            await uToken.mint(to.address, AMOUNT);
            await uToken.connect(to).increaseAllowance(charityPool.address, AMOUNT);
            await charityPool.connect(to).__plainSimpleDeposit_dont_use_(token.address, AMOUNT);
        }

        beforeEach(async function () {
            await distributeTokens(cTokenMock, cTokenUnderlyingMock, owner);
            await distributeTokens(cTokenMock, cTokenUnderlyingMock, addr1);
            await distributeTokens(cTokenMock, cTokenUnderlyingMock, addr2);

            await distributeTokens(aTokenMock, aUnderlyingTokenMock, owner);
            await distributeTokens(aTokenMock, aUnderlyingTokenMock, addr1);
            await distributeTokens(aTokenMock, aUnderlyingTokenMock, addr2);

            await distributeTokens(tjTokenMock, tjTokenUnderlyingMock, owner);
            await distributeTokens(tjTokenMock, tjTokenUnderlyingMock, addr1);
            await distributeTokens(tjTokenMock, tjTokenUnderlyingMock, addr2);
        });


        describe('Migration Cases', () => {
            it('should perform the migration', async () => {
                const charity_cTokenBalance = await cTokenMock.balanceOf(charityPool.address);
                const charity_aTokenBalance = await aTokenMock.balanceOf(charityPool.address);
                const charity_tjTokenBalance = await tjTokenMock.balanceOf(charityPool.address);

                console.log(charity_cTokenBalance, charity_tjTokenBalance)

                await charityPool.migrate(0, 0);

                const aggregator_cTokenBalance = await cTokenMock.balanceOf(contributionsAggregator.address);
                const aggregator_aTokenBalance = await aTokenMock.balanceOf(contributionsAggregator.address);
                const aggregator_tjTokenBalance = await tjTokenMock.balanceOf(contributionsAggregator.address);

                expect(aggregator_cTokenBalance).to.equal(charity_cTokenBalance);
                expect(aggregator_tjTokenBalance).to.equal(charity_tjTokenBalance);
                expect(aggregator_aTokenBalance).to.equal(charity_aTokenBalance);
            })

            it('should set the correct deposited values ', async () => {
                const charity_cTokenBalance = await cTokenMock.balanceOfUnderlying(charityPool.address);
                const charity_aTokenBalance = await aTokenMock.balanceOf(charityPool.address);
                const charity_tjTokenBalance = await tjTokenMock.balanceOfUnderlying(charityPool.address);

                await charityPool.migrate(0, 0);

                const deposited_cTokenBalance = await contributionsAggregator.deposited(cTokenMock.address);
                const deposited_aTokenBalance = await contributionsAggregator.deposited(aTokenMock.address);
                const deposited_tjTokenBalance = await contributionsAggregator.deposited(tjTokenMock.address);


                expect(deposited_cTokenBalance).to.equal(charity_cTokenBalance);
                expect(deposited_aTokenBalance).to.equal(charity_aTokenBalance);
                expect(deposited_tjTokenBalance).to.equal(charity_tjTokenBalance);
            })

            it('should set the correct charity accountedBalances ', async () => {
                const charity_cTokenBalance = await cTokenMock.balanceOfUnderlying(charityPool.address);
                const charity_aTokenBalance = await aTokenMock.balanceOf(charityPool.address);
                const charity_tjTokenBalance = await tjTokenMock.balanceOfUnderlying(charityPool.address);
                await charityPool.migrate(0, 0);

                const charity_cTokenAccountedBalance = await contributionsAggregator.charityAccountedBalance(charityPool.address, cTokenMock.address);
                const charity_aTokenAccountedBalance = await contributionsAggregator.charityAccountedBalance(charityPool.address, aTokenMock.address);
                const charity_tjTokenAccountedBalance = await contributionsAggregator.charityAccountedBalance(charityPool.address, tjTokenMock.address);

                expect(charity_cTokenAccountedBalance).to.equal(charity_cTokenBalance);
                expect(charity_aTokenAccountedBalance).to.equal(charity_aTokenBalance);
                expect(charity_tjTokenAccountedBalance).to.equal(charity_tjTokenBalance);
            })


            it('should set the correct contributor accountedBalances', async () => {
                await charityPool.migrate(0, 0);

                const owner_cTokenAccountedBalance = await contributionsAggregator.contributorAccountedBalance(owner.address, cTokenMock.address);
                const owner_aTokenAccountedBalance = await contributionsAggregator.contributorAccountedBalance(owner.address, aTokenMock.address);
                const owner_tjTokenAccountedBalance = await contributionsAggregator.contributorAccountedBalance(owner.address, tjTokenMock.address);

                const addr1_cTokenAccountedBalance = await contributionsAggregator.contributorAccountedBalance(addr1.address, cTokenMock.address);
                const addr1_aTokenAccountedBalance = await contributionsAggregator.contributorAccountedBalance(addr1.address, aTokenMock.address);
                const addr1_tjTokenAccountedBalance = await contributionsAggregator.contributorAccountedBalance(addr1.address, tjTokenMock.address);

                const addr2_cTokenAccountedBalance = await contributionsAggregator.contributorAccountedBalance(addr2.address, cTokenMock.address);
                const addr2_aTokenAccountedBalance = await contributionsAggregator.contributorAccountedBalance(addr2.address, aTokenMock.address);
                const addr2_tjTokenAccountedBalance = await contributionsAggregator.contributorAccountedBalance(addr2.address, tjTokenMock.address);

                expect(owner_cTokenAccountedBalance).to.equal(AMOUNT);
                expect(owner_aTokenAccountedBalance).to.equal(AMOUNT);
                expect(owner_tjTokenAccountedBalance).to.equal(AMOUNT);

                expect(addr1_cTokenAccountedBalance).to.equal(AMOUNT);
                expect(addr1_aTokenAccountedBalance).to.equal(AMOUNT);
                expect(addr1_tjTokenAccountedBalance).to.equal(AMOUNT);

                expect(addr2_cTokenAccountedBalance).to.equal(AMOUNT);
                expect(addr2_aTokenAccountedBalance).to.equal(AMOUNT);
                expect(addr2_tjTokenAccountedBalance).to.equal(AMOUNT);
            })


            it('should migrate any leftover interest', async () => {
                iHelpMock.getFees.returns([100, 100, 800]);
                iHelpMock.underlyingToken.returns(cTokenUnderlyingMock.address);
                iHelpMock.priceFeedProvider.returns(priceFeedProviderMock.address);

                await cTokenMock.accrueCustom(1200);

                await charityPool.migrate(0, 0);

                expect(await contributionsAggregator.totalRewards(cTokenMock.address)).to.equal(960, "invalid total charity reward amount");

                expect(await contributionsAggregator.claimableRewardOf(charityPool.address, cTokenMock.address)).to.equal(960);
                expect(await contributionsAggregator.generatedInterestOfCharity(cTokenMock.address, charityPool.address)).to.equal(1200, "invalid total charity reward amount");
                expect(await contributionsAggregator.generatedInterestOfContributor(cTokenMock.address, owner.address)).to.equal(400, "invalid total charity reward amount")
            })

        })

        describe('Post Migration Cases', () => {

            it('should let contributors withdraw', async () => {
                await charityPool.migrate(0, 0);

                await charityPool.withdrawAll(owner.address);

                const owner_cUnderlyingBalance = await cTokenUnderlyingMock.balanceOf(owner.address)
                const owner_aUnderlyingBalance = await aUnderlyingTokenMock.balanceOf(owner.address)
                const owner_tjUnderlyingBalance = await tjTokenUnderlyingMock.balanceOf(owner.address)

                expect(owner_cUnderlyingBalance).to.equal(AMOUNT);
                expect(owner_aUnderlyingBalance).to.equal(AMOUNT);
                expect(owner_tjUnderlyingBalance).to.equal(AMOUNT);
            })

            it('should continue acumulating interest', async () => {
                iHelpMock.getFees.returns([100, 100, 800]);
                iHelpMock.underlyingToken.returns(cTokenUnderlyingMock.address);
                iHelpMock.priceFeedProvider.returns(priceFeedProviderMock.address);
                await charityPool.migrate(0, 0);

                await cTokenMock.accrueCustom(1000);
                await contributionsAggregator.redeemInterest(cTokenMock.address);

                expect(await contributionsAggregator.totalRewards(cTokenMock.address)).to.equal(800, "invalid total charity reward amount");

                expect(await contributionsAggregator.generatedInterestOfCharity(cTokenMock.address, charityPool.address)).to.equal(999, "invalid total charity reward amount");
                expect(await contributionsAggregator.generatedInterestOfContributor(cTokenMock.address, owner.address)).to.equal(333, "invalid total charity reward amount")
            })

            it('should allow charity claims', async () => {
                iHelpMock.getFees.returns([100, 100, 800]);
                iHelpMock.underlyingToken.returns(cTokenUnderlyingMock.address);
                iHelpMock.priceFeedProvider.returns(priceFeedProviderMock.address);
                await charityPool.migrate(0, 0);

                await charityPool.setVariable("claimedInterest", {
                    [cTokenMock.address]: 90,
                })

                await charityPool.setVariable("totalInterestEarned", {
                    [cTokenMock.address]: 100,
                })

                await cTokenMock.accrueCustom(1200);
                await contributionsAggregator.redeemInterest(cTokenMock.address);

                expect(await contributionsAggregator.claimableRewardOf(charityPool.address, cTokenMock.address)).to.equal(960);
                await expect(charityPool.claimInterest()).
                    to.emit(cTokenUnderlyingMock, "Transfer").withArgs(contributionsAggregator.address, charityPool.address, 960);

                expect(await charityPool.claimedInterest(cTokenMock.address)).to.equal(1050);
                expect(await charityPool.totalInterestEarned(cTokenMock.address)).to.equal(1300);
            })
        })
    })

});