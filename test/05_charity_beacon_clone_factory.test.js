const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { abi } = require("../artifacts/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json");
use(smock.matchers);


describe('Charity Beacon Factory Deployment', function () {
    let addr2;
    let addrs;
    let stakingPool, cTokenUnderlyingMock, developmentPool, holdingPool, cTokenMock, iHelpMock, holdingMock;
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
        const CharityBeaconFactory = await ethers.getContractFactory('CharityBeaconFactory');
        
        this.factory = await CharityBeaconFactory.deploy(charityPool.address);

    });

    it('should deploy a factory ', async function () {
        await expect(this.factory.deployTransaction.wait()).to.not.be.reverted;
    });

    it('should  deploy a charity ', async function () {
        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
        priceFeedProviderMock = await PriceFeedProvider.deploy();

        const tx1 = await this.factory.createCharityPool({
            charityName: "TestCharity",
            operatorAddress: operator.address,
            charityWalletAddress: cTokenUnderlyingMock.address,
            lendingTokenAddress: cTokenMock.address,
            holdingTokenAddress: holdingMock.address,
            ihelpAddress: iHelpMock.address,
            swapperAddress: swapperMock.address,
            priceFeedProvider: priceFeedProviderMock.address,
            wrappedNativeAddress: cTokenMock.address,
        }, { from: this.accounts[0].address });

        const { events } = await tx1.wait();
        const { address } = events.find(Boolean);

        console.log("Contract deployed at ", address);
        const { interface } = await ethers.getContractFactory('CharityPool');
        const charityPoolInstance = new ethers.Contract(address, interface, this.accounts[0]);
        expect(await charityPoolInstance.name()).to.equal("TestCharity");
    });

    it('should  deploy 2 charity contrcats and update the implementation ', async function () {
        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
        priceFeedProviderMock = await PriceFeedProvider.deploy();

        const tx1 = await this.factory.createCharityPool({
            charityName: "TestCharity1",
            operatorAddress: operator.address,
            charityWalletAddress: cTokenUnderlyingMock.address,
            lendingTokenAddress: cTokenMock.address,
            holdingTokenAddress: holdingMock.address,
            ihelpAddress: iHelpMock.address,
            swapperAddress: swapperMock.address,
            priceFeedProvider: priceFeedProviderMock.address,
            wrappedNativeAddress: cTokenMock.address,
        }, { from: this.accounts[0].address });


        const tx2 = await this.factory.createCharityPool({
            charityName: "TestCharity2",
            operatorAddress: operator.address,
            charityWalletAddress: cTokenUnderlyingMock.address,
            lendingTokenAddress: cTokenMock.address,
            holdingTokenAddress: holdingMock.address,
            ihelpAddress: iHelpMock.address,
            swapperAddress: swapperMock.address,
            priceFeedProvider: priceFeedProviderMock.address,
            wrappedNativeAddress: cTokenMock.address,
        }, { from: this.accounts[0].address });

        const { events: events1 } = await tx1.wait();
        const { address: charity1Address } = events1.find(Boolean);
        console.log("Contract 1 deployed at ", charity1Address);

        const { events: events2 } = await tx2.wait();
        const { address: charity2Address } = events2.find(Boolean);
        console.log("Contract 2 deployed at ", charity2Address);

        const CharityPoolFactory = await ethers.getContractFactory('CharityPool', this.accounts[0]);
        const charityPool1Instance = CharityPoolFactory.attach(charity1Address);
        const charityPool2Instance = CharityPoolFactory.attach(charity2Address);

        const CharityPoolV2Factory = await ethers.getContractFactory('CharityPool2');
        const charityPoolV2 = await CharityPoolV2Factory.deploy();

        expect(await charityPool1Instance.name()).to.equal("TestCharity1");
        expect(await charityPool1Instance.version()).to.equal(1);

        expect(await charityPool2Instance.name()).to.equal("TestCharity2");
        expect(await charityPool2Instance.version()).to.equal(1);

        await this.factory.update(charityPoolV2.address);

        expect(await charityPool1Instance.name()).to.equal("TestCharity1");
        expect(await charityPool1Instance.version()).to.equal(2);

        expect(await charityPool2Instance.name()).to.equal("TestCharity2");
        expect(await charityPool2Instance.version()).to.equal(2);

    });
});
