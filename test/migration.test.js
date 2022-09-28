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
        aUnderlyingTokenMock = await Mock.deploy("aUnderlyingTokenMock", "AUMOCK", 18);
        aTokenMock = await AToken.deploy(aTokenPoolMock.address);

        await aTokenMock.initialize(
            aTokenPoolMock.address,
            addrs[6].address,
            aUnderlyingTokenMock.address,
            ZERO_ADDRESS,
            18,
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
        }, {
            provider: "AAVEProvider",
            lendingAddress: aTokenMock.address,
            currency: "AAVETokenMock",
            underlyingToken: aUnderlyingTokenMock.address,
            priceFeed: aggregator.address,
            connector: AAVEConnector.address
        }]);


        swapperMock.nativeToken.returns(wTokenMock.address);
        swapperMock.getAmountsOutByPath.returns(arg => arg[1] * 1e9);

    });

    describe("Test Migration", function () {
        const distributeTokens = async (token, uToken, to) => {
            await uToken.mint(to.address, parseEther('100000'));
            await uToken.connect(to).increaseAllowance(charityPool.address, parseEther('100000'));
            await charityPool.connect(to).__plainSimpleDeposit_dont_use_(token.address, parseEther('852'));
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

        it('should perform the migration', async () => {
            await charityPool.migrate(0, 0);
        })

    });
});