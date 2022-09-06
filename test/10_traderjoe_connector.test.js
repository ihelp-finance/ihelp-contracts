const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");

const { abi } = require("../artifacts/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json");
const { parseEther, parseUnits } = require('ethers/lib/utils');

use(smock.matchers);

async function deploy(name, ...params) {
    const Contract = await ethers.getContractFactory(name);
    return await Contract.deploy(...params).then(f => f.deployed());
}

describe('TraderJoe Connector tests', function () {
    let charityPool;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let stakingPool, wTokenMock, developmentPool, holdingPool, iHelpMock, holdingMock, aggregator;
    let TJConnector;
    let priceFeedProviderMock
    let tjTokenMock;
    let uMock;
    beforeEach(async function () {
        [owner, addr1, addr2, stakingPool, developmentPool, holdingPool, operator, swapperPool, charityWallet, ...addrs] = await ethers.getSigners();

        const CharityPool = await smock.mock("CharityPool");
        const Mock = await smock.mock("ERC20MintableMock");
        const TJToken = await smock.mock("TJTokenMock");
        const WMock = await ethers.getContractFactory("WTokenMock");

        const ProtocolConnector = await smock.mock("TraderJoeConnector");
        TJConnector = await ProtocolConnector.deploy();
        await TJConnector.initialize();

        uMock = await Mock.deploy("uMock", "uMOK", 6);
        tjTokenMock = await TJToken.deploy(uMock.address, 1000);

        aggregator = await smock.fake(abi);
        aggregator.latestRoundData.returns([0, 1e9, 0, 0, 0]);

        iHelpMock = await smock.fake("iHelpToken", { address: addr2.address });

        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
        priceFeedProviderMock = await PriceFeedProvider.deploy();


        wTokenMock = await WMock.deploy();
        holdingMock = await Mock.deploy("Mock", "MOK", 9);

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
            lendingAddress: tjTokenMock.address,
            currency: "TJTokenMock",
            underlyingToken: uMock.address,
            priceFeed: aggregator.address,
            connector: TJConnector.address
        }]);

        iHelpMock.stakingPool.returns(stakingPool.address);
        iHelpMock.developmentPool.returns(developmentPool.address);
        iHelpMock.getPools.returns([developmentPool.address, stakingPool.address]);
        swapperMock.nativeToken.returns(wTokenMock.address);
        swapperMock.getAmountsOutByPath.returns(arg => arg[1]);
    });

    describe('Connector should be a drop in replacement for any cToken', () => {

        beforeEach(async function () {
            tjTokenMock.decimals.returns(1e8);
            await uMock.mint(owner.address, 15);
            await uMock.increaseAllowance(charityPool.address, parseUnits('15', 6));

            await uMock.mint(addr1.address, 15);
            await uMock.connect(addr1).increaseAllowance(charityPool.address, parseUnits('15', 6));
        });

        it("should deposit tokens", async function () {
            await charityPool.depositTokens(tjTokenMock.address, 15, "test memo");
            expect(await tjTokenMock.balanceOf(charityPool.address)).to.equal(15 * 1e2);
            expect(await tjTokenMock.balanceOfUnderlying(charityPool.address)).to.equal(15);
            expect(await uMock.balanceOf(owner.address)).to.equal(0);

            await charityPool.connect(addr1).depositTokens(tjTokenMock.address, 15, "test memo");
            expect(await tjTokenMock.balanceOf(charityPool.address)).to.equal(30 * 1e2);
            expect(await tjTokenMock.balanceOfUnderlying(charityPool.address)).to.equal(30);
            expect(await uMock.balanceOf(addr1.address)).to.equal(0);
        });

        it("should withdraw tokens", async function () {
            await charityPool.depositTokens(tjTokenMock.address, 15, "test memo");
            console.log(await tjTokenMock.balanceOf(charityPool.address), "Balance");

            await charityPool.withdrawTokens(tjTokenMock.address, 10);

            expect(await tjTokenMock.balanceOfUnderlying(charityPool.address)).to.equal(5);
            expect(await uMock.balanceOf(owner.address)).to.equal(10);
            expect(await tjTokenMock.balanceOf(charityPool.address)).to.equal(parseUnits('5', 2));

        });
    })
});
