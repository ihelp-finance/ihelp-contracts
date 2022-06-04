const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { abi } = require("../artifacts/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json");
use(smock.matchers);

async function deploy(name, ...params) {
    const Contract = await ethers.getContractFactory(name);
    return await Contract.deploy(...params).then(f => f.deployed());
}

describe('Charity Factory Deployment', function () {
    let charityPool;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let stakingPool, cTokenUnderlyingMock, developmentPool, holdingPool, cTokenMock, iHelpMock, holdingMock, aggregator;
    beforeEach(async function () {

        const CharityPool = await smock.mock("CharityPool");

        [owner, addr1, addr2, stakingPool, developmentPool, holdingPool, operator, swapperPool, ...addrs] = await ethers.getSigners();

        const Mock = await smock.mock("ERC20MintableMock");
        const CTokenMock = await smock.mock("CTokenMock");
        aggregator = await smock.fake(abi);
        iHelpMock = await smock.fake("iHelpToken", { address: addr2.address });

        cTokenUnderlyingMock = await Mock.deploy("Mock", "MOK", 18);
        holdingMock = await Mock.deploy("Mock", "MOK", 9);
        cTokenMock = await CTokenMock.deploy(cTokenUnderlyingMock.address, 1000);

        charityPool = await CharityPool.deploy();
        swapperMock = await smock.fake("Swapper", { address: swapperPool.address });

        this.accounts = await ethers.getSigners();
        this.factory = await deploy('CharityPoolCloneFactory');

    });

    it('should deploy a factory ', async function () {
        await expect(this.factory.deployTransaction.wait()).to.not.be.reverted;
    });

    it('should  deploy a charity ', async function () {
        const tx1 = await this.factory.createCharityPool({
            charityName: "TestCharity",
            operatorAddress: operator.address,
            holdingPoolAddress: holdingPool.address,
            charityWalletAddress: cTokenUnderlyingMock.address,
            charityTokenName: "XTC",
            lendingTokenAddress: cTokenMock.address,
            holdingTokenAddress: holdingMock.address,
            priceFeedAddress: aggregator.address,
            ihelpAddress: iHelpMock.address,
            swapperAddress: swapperMock.address,
            stakingPoolAddress: stakingPool.address,
            developmentPoolAddress: developmentPool.address
        }, { from: this.accounts[0].address });

        const { gasUsed: createGasUsed, events } = await tx1.wait();
        const { address } = events.find(Boolean);

        console.log("Contract deployed at ", address);
        const { interface } = await ethers.getContractFactory('CharityPool');
        const charityPoolInstance = new ethers.Contract(address, interface, this.accounts[0]);


        expect(await charityPoolInstance.stakingPool()).to.equal(stakingPool.address);

    });
});
