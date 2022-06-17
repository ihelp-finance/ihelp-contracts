const { expect, use } = require("chai");

const { smock } = require("@defi-wonderland/smock");

use(smock.matchers);

describe("Analytics", function () {
    let iHelp, analytics, charityPool1, charityPool2;
    let owner;
    let addr1;
    let addr2;
    let addr3;
    let addrs;
    let stakingPool, developmentPool, holdingPool;
    let wTokenMock;
    let CTokenMock;
    let uMock1, uMock2, cTokenMock1, cTokenMock2;

    beforeEach(async function () {
        const IHelp = await smock.mock("iHelpToken");
        const CharityPool = await smock.mock("CharityPool");

        const Mock = await smock.mock("ERC20MintableMock");

        [owner, addr1, addr2, addr3, operator, stakingPool, developmentPool, holdingPool, swapperPool, ...addrs] = await ethers.getSigners();
        CTokenMock = await smock.mock("CTokenMock");
        const WMock = await ethers.getContractFactory("WTokenMock");
        const Analytics = await ethers.getContractFactory("Analytics");

        analytics = await Analytics.deploy();
        uMock1 = await Mock.deploy("Mock", "MOK", 18);
        uMock2 = await Mock.deploy("Mock", "MOK", 18);
        mockContract = await Mock.deploy("Mock", "MOK", 18);

        cTokenMock1 = await CTokenMock.deploy(uMock1.address, 1000);
        cTokenMock2 = await CTokenMock.deploy(uMock2.address, 1000);

        iHelp = await IHelp.deploy();

        await iHelp.initialize(
            "iHelp",
            "IHLP",
            operator.address,
            stakingPool.address,
            developmentPool.address,
            holdingPool.address,
            mockContract.address
        );

        holdingMock = await Mock.deploy("Mock", "MOK", 9);
        wTokenMock = await WMock.deploy();

        charityPool1 = await CharityPool.deploy();
        charityPool2 = await CharityPool.deploy();

        await charityPool1.setVariable("operator", owner.address);
        await charityPool2.setVariable("operator", owner.address);

        swapperMock = await smock.fake("Swapper", { address: swapperPool.address });

        charityPool1.getUnderlyingTokenValue.returns(([, arg]) => arg * 100000000);
        charityPool2.getUnderlyingTokenValue.returns(([, arg]) => arg * 100000000);

        charityPool1.calculateTotalInterestEarned.returns(20);
        charityPool2.calculateTotalInterestEarned.returns(30);

    });

    describe("Analytics testing", async () => {
        it("should return the generated interest", async () => {
            expect(await analytics.generatedInterest(charityPool1.address)).to.equal(20);
            expect(await analytics.generatedInterest(charityPool2.address)).to.equal(30);
        });

        it("should return the total generated interest", async () => {
            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);

            expect(await analytics.totalGeneratedInterest(iHelp.address)).to.equal(50);
        });

        it("should return the total generated interest by a yield protocol", async () => {
            await charityPool2.setVariable("totalInterestEarned", {
                [cTokenMock1.address]: 45,
                [cTokenMock2.address]: 25
            });

            await charityPool1.setVariable("totalInterestEarned", {
                [cTokenMock1.address]: 15,
                [cTokenMock2.address]: 10
            });

            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);

            expect(await analytics.getYieldProtocolGeneratedInterest(iHelp.address, cTokenMock1.address)).to.equal(60);
            expect(await analytics.getYieldProtocolGeneratedInterest(iHelp.address, cTokenMock2.address)).to.equal(35);
        });

        it("should return the total generated interest by a underlying currency", async () => {
            await charityPool1.addCToken(cTokenMock1.address);
            await charityPool2.addCToken(cTokenMock1.address);

            await charityPool1.addCToken(cTokenMock2.address);
            await charityPool2.addCToken(cTokenMock2.address);

            await charityPool2.setVariable("totalInterestEarned", {
                [cTokenMock1.address]: 25,
                [cTokenMock2.address]: 15
            });

            await charityPool1.setVariable("totalInterestEarned", {
                [cTokenMock1.address]: 5,
                [cTokenMock2.address]: 10
            });

            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);

            expect(await analytics.getUnderlyingCurrencyGeneratedInterest(iHelp.address, uMock1.address)).to.equal(30);
            expect(await analytics.getUnderlyingCurrencyGeneratedInterest(iHelp.address, uMock2.address)).to.equal(25);
        });

        it("should return the user generated interest", async () => {
            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);

            await iHelp.setVariable("contirbutorGeneratedInterest", {
                [addr1.address]: {
                    [charityPool1.address]: 10,
                    [charityPool2.address]: 20
                },
                [addr2.address]: {
                    [charityPool1.address]: 5,
                    [charityPool2.address]: 5
                }
            });

            expect(await analytics.getUserGeneratedInterest(iHelp.address, addr1.address)).to.equal(30);
            expect(await analytics.getUserGeneratedInterest(iHelp.address, addr2.address)).to.equal(10);
        });

        it("should return the total user generated interest", async () => {
            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);

            charityPool1.numberOfContributors.returns(2);
            charityPool2.numberOfContributors.returns(2);

            const contributors = [
                addr1.address,
                addr2.address
            ]
            charityPool2.contributorAt.returns(idx => contributors[idx]);
            charityPool1.contributorAt.returns(idx => contributors[idx]);

            await iHelp.setVariable("contirbutorGeneratedInterest", {
                [addr1.address]: {
                    [charityPool1.address]: 10,
                    [charityPool2.address]: 20
                },
                [addr2.address]: {
                    [charityPool1.address]: 5,
                    [charityPool2.address]: 5
                }
            });

            expect(await analytics.getTotalUserGeneratedInterest(iHelp.address)).to.equal(40);
        });

        it("should return the total locked value", async () => {
            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);

            charityPool1.accountedBalanceUSD.returns(200);
            charityPool2.accountedBalanceUSD.returns(200);

            expect(await analytics.totalLockedValue(iHelp.address)).to.equal(400);
        });

        it("should return the total locked value of a charity", async () => {
            await iHelp.registerCharityPool(charityPool1.address);

            charityPool1.accountedBalanceUSD.returns(200);

            expect(await analytics.totalLockedValue(iHelp.address)).to.equal(200);
        });

        it("should return the total number of helpers", async () => {
            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);

            charityPool1.numberOfContributors.returns(200);
            charityPool2.numberOfContributors.returns(200);

            expect(await analytics.totalHelpers(iHelp.address)).to.equal(400);
        });

        it("should return the total number of helpers for a given charity", async () => {
            await iHelp.registerCharityPool(charityPool1.address);

            charityPool1.numberOfContributors.returns(200);

            expect(await analytics.totalHelpersInCharity(charityPool1.address)).to.equal(200);
        });
    });
});