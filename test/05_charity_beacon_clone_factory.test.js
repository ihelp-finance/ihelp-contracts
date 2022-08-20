const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { abi } = require("../artifacts/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json");
const { constructorCode } = require('@openzeppelin/upgrades');
use(smock.matchers);


describe('Charity Beacon Factory Deployment', function () {
    let addr2;
    let addrs;
    let cTokenUnderlyingMock, cTokenMock, iHelpMock, holdingMock, operator;
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

        this.factory = await CharityBeaconFactory.deploy();
        await this.factory.initialize(charityPool.address);
    });

    it('should deploy a factory ', async function () {
        await expect(this.factory.deployTransaction.wait()).to.not.be.reverted;
    });

    it('should  deploy a charity', async function () {
        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
        priceFeedProviderMock = await PriceFeedProvider.deploy();

        const tx1 = await this.factory.createCharityPool([{
            charityName: "TestCharity",
            operatorAddress: operator.address,
            charityWalletAddress: cTokenUnderlyingMock.address,
            holdingTokenAddress: holdingMock.address,
            ihelpAddress: iHelpMock.address,
            swapperAddress: swapperMock.address,
            priceFeedProvider: priceFeedProviderMock.address,
            wrappedNativeAddress: cTokenMock.address,
        }], { from: this.accounts[0].address });

        const { events } = await tx1.wait();
        const { args } = events.find(item => item.event === 'Created');

        const { addr: address } = args.newCharities[0];
        const { interface } = await ethers.getContractFactory('CharityPool');
        const charityPoolInstance = new ethers.Contract(address, interface, this.accounts[0]);
        expect(await charityPoolInstance.name()).to.equal("TestCharity");
    });

    it('should  deploy 2 charity contracts and update the implementation ', async function () {
        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
        priceFeedProviderMock = await PriceFeedProvider.deploy();

        const tx1 = await this.factory.createCharityPool([{
            charityName: "TestCharity1",
            operatorAddress: operator.address,
            charityWalletAddress: cTokenUnderlyingMock.address,
            holdingTokenAddress: holdingMock.address,
            ihelpAddress: iHelpMock.address,
            swapperAddress: swapperMock.address,
            priceFeedProvider: priceFeedProviderMock.address,
            wrappedNativeAddress: cTokenMock.address,
        }, {
            charityName: "TestCharity2",
            operatorAddress: operator.address,
            charityWalletAddress: cTokenUnderlyingMock.address,
            holdingTokenAddress: holdingMock.address,
            ihelpAddress: iHelpMock.address,
            swapperAddress: swapperMock.address,
            priceFeedProvider: priceFeedProviderMock.address,
            wrappedNativeAddress: cTokenMock.address,
        }], { from: this.accounts[0].address });

        const { events } = await tx1.wait();
        const { args } = events.find(item => item.event === 'Created');
        const [c1, c2] = args.newCharities;
        const charity1Address = c1.addr;
        const charity2Address = c2.addr;

        console.log("Contract 1 deployed at ", charity1Address);
        console.log("Contract 2 deployed at ", charity2Address);

        const CharityPoolFactory = await ethers.getContractFactory('CharityPool', this.accounts[0]);
        const charityPool1Instance = CharityPoolFactory.attach(charity1Address);
        const charityPool2Instance = CharityPoolFactory.attach(charity2Address);

        const CharityPoolV2Factory = await ethers.getContractFactory('CharityPool2');
        const charityPoolV2 = await CharityPoolV2Factory.deploy();

        expect(await charityPool1Instance.name()).to.equal("TestCharity1");
        expect(await charityPool1Instance.version()).to.equal(2);

        expect(await charityPool2Instance.name()).to.equal("TestCharity2");
        expect(await charityPool2Instance.version()).to.equal(2);

        await this.factory.update(charityPoolV2.address);

        expect(await charityPool1Instance.name()).to.equal("TestCharity1");
        expect(await charityPool1Instance.version()).to.equal(3);

        expect(await charityPool2Instance.name()).to.equal("TestCharity2");
        expect(await charityPool2Instance.version()).to.equal(3);
    });

    describe('Client Deployments', () => {
        it('should set the default charity configuration', async function () {
            const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
            priceFeedProviderMock = await PriceFeedProvider.deploy();

            await this.factory.setDefaultCharityConfiguration({
                charityName: "TestCharity1",
                operatorAddress: operator.address,
                charityWalletAddress: cTokenUnderlyingMock.address,
                holdingTokenAddress: holdingMock.address,
                ihelpAddress: iHelpMock.address,
                swapperAddress: swapperMock.address,
                priceFeedProvider: priceFeedProviderMock.address,
                wrappedNativeAddress: cTokenMock.address,
            });

            const result = await this.factory.defaultCharityConfiguration();
            expect(result.charityName).to.equal('TestCharity1');
        })

        it('should revert if default is not configured', async function () {
            await expect(this.factory.createCharityPoolFromClient("Test")).to.be.revertedWith('config/not-set');
        })

        it('should revert if charity name is blank', async function () {
            await expect(this.factory.createCharityPoolFromClient("")).to.be.revertedWith('params/invalid-length');
        })

        it('should add a new charity', async function () {
            const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
            priceFeedProviderMock = await PriceFeedProvider.deploy();

             await this.factory.setDefaultCharityConfiguration({
                charityName: "TestCharity1",
                operatorAddress: operator.address,
                charityWalletAddress: cTokenUnderlyingMock.address,
                holdingTokenAddress: holdingMock.address,
                ihelpAddress: iHelpMock.address,
                swapperAddress: swapperMock.address,
                priceFeedProvider: priceFeedProviderMock.address,
                wrappedNativeAddress: cTokenMock.address
            });

            const tx1 = await this.factory.createCharityPoolFromClient("CustomName");
            const { events } = await tx1.wait();
            const { args } = events.find(item => item.event === 'Created');

            const { addr: address } = args.newCharities[0];
            const { interface } = await ethers.getContractFactory('CharityPool');
            const charityPoolInstance = new ethers.Contract(address, interface, this.accounts[0]);
            expect(await charityPoolInstance.name()).to.equal("CustomName");
        })
    })
});
