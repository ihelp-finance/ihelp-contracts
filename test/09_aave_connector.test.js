const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");

const { abi } = require("../artifacts/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json");
const { abi: PoolAbi } = require("../artifacts/@aave/core-v3/contracts/interfaces/IPool.sol/IPool.json");
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

use(smock.matchers);

async function deploy(name, ...params) {
    const Contract = await ethers.getContractFactory(name);
    return await Contract.deploy(...params).then(f => f.deployed());
}

describe('AAVE Connector tests', function () {
    let charityPool;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let stakingPool, wTokenMock, developmentPool, holdingPool, iHelpMock, holdingMock, aggregator;
    let AAVEConnector;
    let aTokenPoolMock
    let aTokenMock;
    let uMock;
    beforeEach(async function () {
        [owner, addr1, addr2, stakingPool, developmentPool, holdingPool, operator, swapperPool, charityWallet, ...addrs] = await ethers.getSigners();

        const CharityPool = await smock.mock("CharityPool");
        const Mock = await smock.mock("ERC20MintableMock");
        const WMock = await ethers.getContractFactory("WTokenMock");
        const AToken = await smock.mock("ATokenMock");
        const APool = await smock.mock("APoolMock");

        aTokenPoolMock = await APool.deploy();
        uMock = await Mock.deploy("uMock", "uMOK", 18);
        aTokenMock = await AToken.deploy(aTokenPoolMock.address);

        await aTokenMock.initialize(
            aTokenPoolMock.address,
            addrs[6].address,
            uMock.address,
            ZERO_ADDRESS,
            18,
            "aTokenMock",
            "ATKNM",
            Buffer.from("0")
        );

        await aTokenPoolMock.setAToken(aTokenMock.address);

        const ProtocolConnector = await smock.mock("AAVEConnector");
        AAVEConnector = await ProtocolConnector.deploy();
        await AAVEConnector.initialize();

        aggregator = await smock.fake(abi);
        aggregator.latestRoundData.returns([0, 1e9, 0, 0, 0]);

        iHelpMock = await smock.fake("iHelpToken", { address: addr2.address });
        
        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
        priceFeedProviderMock = await PriceFeedProvider.deploy();

        holdingMock = await Mock.deploy("Mock", "MOK", 9);
        wTokenMock = await WMock.deploy();

        charityPool = await CharityPool.deploy();
        swapperMock = await smock.fake("Swapper", { address: swapperPool.address });
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
            provider: "TestProvider",
            lendingAddress: aTokenMock.address,
            currency: "ATokenMock",
            underlyingToken: uMock.address,
            priceFeed: aggregator.address,
            connector: AAVEConnector.address
        }]);

        iHelpMock.stakingPool.returns(stakingPool.address);
        iHelpMock.developmentPool.returns(developmentPool.address);
        iHelpMock.getPools.returns([developmentPool.address, stakingPool.address]);
        swapperMock.nativeToken.returns(wTokenMock.address);
        swapperMock.getAmountsOutByPath.returns(arg => arg[1]);
    });

    describe('Connector should be a drop in replacement for any cToken', () => {

        beforeEach(async function () {
            await uMock.mint(owner.address, 15);
            await uMock.increaseAllowance(charityPool.address, 15);
        });

        it("should deposit tokens", async function () {
            await charityPool.depositTokens(aTokenMock.address, 15,"test memo");
            expect(await AAVEConnector.accrueAndGetBalance(aTokenMock.address, charityPool.address)).to.equal(15);
            expect(await AAVEConnector.balanceOf(aTokenMock.address, charityPool.address)).to.equal(15);
            expect(await uMock.balanceOf(owner.address)).to.equal(0);

        });

        it("should withdraw tokens", async function () {
            await charityPool.depositTokens(aTokenMock.address, 15, "test memo");
            console.log(await aTokenMock.balanceOf(charityPool.address), "Balance");
            await charityPool.withdrawTokens(aTokenMock.address, 10);
            expect(await AAVEConnector.accrueAndGetBalance(aTokenMock.address, charityPool.address)).to.equal(5);
            expect(await AAVEConnector.balanceOf(aTokenMock.address, charityPool.address)).to.equal(5);
            expect(await uMock.balanceOf(owner.address)).to.equal(10);
        });
    })
});
