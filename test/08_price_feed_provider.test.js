const { expect, use } = require("chai");
const AggregatorInfoAbi = require('@chainlink/contracts/abi/v0.4/AggregatorV3Interface.json')
const { smock } = require("@defi-wonderland/smock");
const {
    constants,
} = require('@openzeppelin/test-helpers');
const { BigNumber } = require('ethers');

use(smock.matchers);

describe("PriceFeedProvider", function () {
    let priceFeedProvider;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let CTokenMock;
    let underlyingMock1, underlyingMock2, cTokenMock1, cTokenMock2;
    let donationCurrencies, chainLinkAggretator;
    let mockConnector

    beforeEach(async function () {
        const Mock = await smock.mock("ERC20MintableMock");
        chainLinkAggretator = await smock.fake(AggregatorInfoAbi);

        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        CTokenMock = await smock.mock("CTokenMock");
        const PriceFeedProvider = await smock.mock("PriceFeedProvider", {
            signer: owner
        });

        underlyingMock1 = await Mock.deploy("Mock", "MOK", 18);
        underlyingMock2 = await Mock.deploy("Mock", "MOK", 18);

        cTokenMock1 = await CTokenMock.deploy(underlyingMock1.address, 1000);
        cTokenMock2 = await CTokenMock.deploy(underlyingMock1.address, 1000);

        mockConnector = await smock.mock('CompoundConnector');
        mockConnector = await mockConnector.deploy();

        let tjMockConnector =  await smock.mock('TraderJoeConnector');
        tjMockConnector =  await tjMockConnector.deploy();
        
        priceFeedProvider = await PriceFeedProvider.deploy();

        console.log(mockConnector.address)
        donationCurrencies = [{
            provider: "Provider1",
            currency: "ETH",
            underlyingToken: underlyingMock1.address,
            lendingAddress: cTokenMock1.address,
            priceFeed: chainLinkAggretator.address,
            connector: mockConnector.address
        }, {
            provider: "Provider2",
            currency: "ETH",
            underlyingToken: underlyingMock2.address,
            lendingAddress: cTokenMock2.address,
            priceFeed: chainLinkAggretator.address,
            connector: tjMockConnector.address
            
        }];
        await priceFeedProvider.initialize(donationCurrencies);
    });

    describe("Deployment", async () => {
        it("should set the right owner", async function () {
            expect(await priceFeedProvider.owner()).to.equal(owner.address);
        });

        it("should set initial list of donation currencies", async function () {
            const currencies = await priceFeedProvider.getAllDonationCurrencies();
            expect(currencies.length).to.equal(2);
            expect(currencies[0].provider).to.equal(donationCurrencies[0].provider);
        });
    });

    describe("Configuration", async () => {
        describe("Adding new donation currencies", async () => {
            it("should revert if not owner", async function () {
                await expect(priceFeedProvider.connect(addr1).addDonationCurrencies()).to.be.reverted;
            });

            it("should revert if lending token is 0x", async function () {
                await expect(priceFeedProvider.addDonationCurrencies([{
                    provider: "Provider",
                    currency: "ETH",
                    underlyingToken: underlyingMock2.address,
                    lendingAddress: constants.ZERO_ADDRESS,
                    priceFeed: chainLinkAggretator.address,
                    connector: mockConnector.address
                }])).to.be.revertedWith("price-feed/invalid-lending");
            });

            it("should revert if price feed is 0x", async function () {
                await expect(priceFeedProvider.addDonationCurrencies([{
                    provider: "Provider",
                    currency: "ETH",
                    underlyingToken: underlyingMock2.address,
                    lendingAddress: cTokenMock2.address,
                    priceFeed: constants.ZERO_ADDRESS,
                    connector: mockConnector.address
                }])).to.be.revertedWith("price-feed/invalid-price-feed");
            });

            it("should revert if undelying token is 0x", async function () {
                await expect(priceFeedProvider.addDonationCurrencies([{
                    provider: "Provider",
                    currency: "ETH",
                    underlyingToken: constants.ZERO_ADDRESS,
                    lendingAddress: cTokenMock2.address,
                    priceFeed: chainLinkAggretator.address,
                    connector: mockConnector.address
                }])).to.be.revertedWith("price-feed/invalid-underlying");
            });

            it("should revert if already exists", async function () {
                await expect(priceFeedProvider.addDonationCurrencies([{
                    provider: "Provider3",
                    currency: "ETH",
                    underlyingToken: underlyingMock2.address,
                    lendingAddress: cTokenMock2.address,
                    priceFeed: chainLinkAggretator.address,
                    connector: mockConnector.address
                }])).to.be.revertedWith("price-feed/already-exists");
            });

            it("should add new donation currency", async function () {
                expect(await priceFeedProvider.addDonationCurrencies([{
                    provider: "Provider3",
                    currency: "ETH",
                    underlyingToken: addrs[5].address,
                    lendingAddress: addrs[6].address,
                    priceFeed: addrs[7].address,
                    connector: mockConnector.address
                }]));

                const currencies = await priceFeedProvider.getAllDonationCurrencies();

                expect(currencies.length).to.equal(3);
                expect(currencies[2].provider).to.equal("Provider3");
                expect(currencies[2].underlyingToken).to.equal(addrs[5].address);
                expect(currencies[2].lendingAddress).to.equal(addrs[6].address);
                expect(currencies[2].priceFeed).to.equal(addrs[7].address);
            });
        })

        describe("Removing donation currencies", async () => {
            it("should revert if not owner", async function () {
                await expect(priceFeedProvider.connect(addr1).removeDonationCurrency(donationCurrencies[0].lendingAddress)).to.be.reverted;
            });

            it("should remove donation currency", async function () {
                expect(await priceFeedProvider.removeDonationCurrency(donationCurrencies[0].lendingAddress));

                const currencies = await priceFeedProvider.getAllDonationCurrencies();

                expect(currencies.length).to.equal(1);
                expect(currencies[0].provider).to.equal("Provider2");
                expect(currencies[0].underlyingToken).to.equal(donationCurrencies[1].underlyingToken);
                expect(currencies[0].lendingAddress).to.equal(donationCurrencies[1].lendingAddress);
                expect(currencies[0].priceFeed).to.equal(donationCurrencies[1].priceFeed);
            });
        })

        describe("Updating donation currencies", async () => {
            it("should revert if not owner", async function () {
                await expect(priceFeedProvider.connect(addr1).updateDonationCurrency(donationCurrencies[0].lendingAddress)).to.be.reverted;
            });


            it("should revert if lending token is 0x", async function () {
                await expect(priceFeedProvider.updateDonationCurrency({
                    provider: "Provider",
                    currency: "ETH",
                    underlyingToken: underlyingMock2.address,
                    lendingAddress: constants.ZERO_ADDRESS,
                    priceFeed: chainLinkAggretator.address,
                    connector: mockConnector.address
                })).to.be.revertedWith("price-feed/invalid-lending");
            });

            it("should revert if price feed is 0x", async function () {
                await expect(priceFeedProvider.updateDonationCurrency({
                    provider: "Provider",
                    currency: "ETH",
                    underlyingToken: underlyingMock2.address,
                    lendingAddress: cTokenMock2.address,
                    priceFeed: constants.ZERO_ADDRESS,
                    connector: mockConnector.address
                })).to.be.revertedWith("price-feed/invalid-price-feed");
            });

            it("should revert if undelying token is 0x", async function () {
                await expect(priceFeedProvider.updateDonationCurrency({
                    provider: "Provider",
                    currency: "ETH",
                    underlyingToken: constants.ZERO_ADDRESS,
                    lendingAddress: cTokenMock2.address,
                    priceFeed: chainLinkAggretator.address,
                    connector: mockConnector.address
                })).to.be.revertedWith("price-feed/invalid-underlying");
            });

            it("should revert if donation currency is not found", async function () {
                await expect(priceFeedProvider.updateDonationCurrency({
                    provider: "Provider3",
                    currency: "ETH",
                    underlyingToken: underlyingMock2.address,
                    lendingAddress: addr1.address,
                    priceFeed: chainLinkAggretator.address,
                    connector: mockConnector.address
                })).to.be.revertedWith("price-feed/not-found");
            });

            it("should update donation currency", async function () {
                await priceFeedProvider.updateDonationCurrency({
                    provider: "Provider3",
                    currency: "ETH",
                    underlyingToken: addrs[5].address,
                    lendingAddress: cTokenMock2.address,
                    priceFeed: addrs[7].address,
                    connector: mockConnector.address
                });

                const currencies = await priceFeedProvider.getAllDonationCurrencies();

                expect(currencies.length).to.equal(2);
                expect(currencies[1].provider).to.equal("Provider3");
                expect(currencies[1].underlyingToken).to.equal(addrs[5].address);
                expect(currencies[1].lendingAddress).to.equal(cTokenMock2.address);
                expect(currencies[1].priceFeed).to.equal(addrs[7].address);
            });
        });
    });

    describe("Price Data", async () => {
        it("should return price data from price feed", async () => {
            chainLinkAggretator.latestRoundData.returns([0, 100, 0, 0, 0]);
            chainLinkAggretator.decimals.returns(8);

            const [price, decimals] = await priceFeedProvider.getUnderlyingTokenPrice(cTokenMock2.address);
            expect(price).to.equal(100);
            expect(decimals).to.equal(8);
        })
    })

    describe("Currency Data", async () => {
        it("should calculated currency APY for compound protocol", async () => {
            await  cTokenMock1.setVariable('__supplyRatePerBlock', 1152785640)
            
            const SUPPLY_RATE = await cTokenMock1.supplyRatePerBlock();
            const apr = await priceFeedProvider.getCurrencyApr(donationCurrencies[0].lendingAddress, 4 * 1000);
            const blocksPerDay = 86_400 / 4;
            const expectedAPR = BigNumber.from('' + SUPPLY_RATE).mul(blocksPerDay * 365);
            
            const formatedApr =  apr/1e18;
            console.log('APR', formatedApr);
            console.log("APY", (1+(apr/1e18)/365)**365 - 1);
            
            expect(apr).to.equal(expectedAPR);
        })

        it("should calculated currency APY for traderjoe protocol ", async () => {
            await  cTokenMock2.setVariable('__supplyRatePerSecond', 288196410)
            
            const SUPPLY_RATE = await cTokenMock2.supplyRatePerSecond();
            const apr = await priceFeedProvider.getCurrencyApr(donationCurrencies[1].lendingAddress, 4 * 1000);
            const blocksPerDay = 86_400 / 4;
            const expectedAPR = BigNumber.from('' + SUPPLY_RATE).mul(4  * blocksPerDay * 365);
            console.log('APR', apr/1e18);
            console.log("APY", (1+(apr/1e18)/365)**365 - 1);
        
            expect(apr).to.equal(expectedAPR);
        })
    })

});