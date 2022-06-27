const { expect, use } = require("chai");

const { smock } = require("@defi-wonderland/smock");

use(smock.matchers);

describe("Analytics", function () {
    let iHelp, analytics, charityPool1, charityPool2;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let stakingPool, developmentPool, holdingPool;
    let CTokenMock;
    let uMock1, uMock2, cTokenMock1, cTokenMock2;

    beforeEach(async function () {
        const IHelp = await smock.mock("iHelpToken");
        const CharityPool = await smock.mock("CharityPool");

        const Mock = await smock.mock("ERC20MintableMock");

        [owner, addr1, addr2, operator, stakingPool, developmentPool, holdingPool, swapperPool, ...addrs] = await ethers.getSigners();
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
        describe("Isolated calls", () => {
            it("should return the generated interest", async () => {
                expect(await analytics.generatedInterest(charityPool1.address)).to.equal(20);
                expect(await analytics.generatedInterest(charityPool2.address)).to.equal(30);
            });

            it("should return the total generated interest", async () => {
                await iHelp.registerCharityPool(charityPool1.address);
                await iHelp.registerCharityPool(charityPool2.address);

                expect(await analytics.totalGeneratedInterest(iHelp.address, 0, 0)).to.equal(50);
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

                expect(await analytics.getYieldProtocolGeneratedInterest(iHelp.address, cTokenMock1.address, 0, 0)).to.equal(60);
                expect(await analytics.getYieldProtocolGeneratedInterest(iHelp.address, cTokenMock2.address, 0, 0)).to.equal(35);
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

                expect(await analytics.getUnderlyingCurrencyGeneratedInterest(iHelp.address, uMock1.address, 0, 0)).to.equal(30);
                expect(await analytics.getUnderlyingCurrencyGeneratedInterest(iHelp.address, uMock2.address, 0, 0)).to.equal(25);
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

                expect(await analytics.getUserGeneratedInterest(iHelp.address, addr1.address, 0, 0)).to.equal(30);
                expect(await analytics.getUserGeneratedInterest(iHelp.address, addr2.address, 0, 0)).to.equal(10);
            });

            it("should return the total user generated interest", async () => {
                await iHelp.setVariable("totalContributorGeneratedInterest", 40);

                expect(await analytics.getTotalUserGeneratedInterest(iHelp.address)).to.equal(40);
            });

            it("should return the total locked value", async () => {
                await iHelp.registerCharityPool(charityPool1.address);
                await iHelp.registerCharityPool(charityPool2.address);

                charityPool1.accountedBalanceUSD.returns(200);
                charityPool2.accountedBalanceUSD.returns(200);

                expect(await analytics.totalLockedValue(iHelp.address, 0, 0)).to.equal(400);
            });

            it("should return the total locked value of a charity", async () => {
                await iHelp.registerCharityPool(charityPool1.address);
                charityPool1.accountedBalanceUSD.returns(200);

                expect(await analytics.totalCharityLockedValue(charityPool1.address)).to.equal(200);
            });

            it("should return the total number of helpers", async () => {
                await iHelp.registerCharityPool(charityPool1.address);
                await iHelp.registerCharityPool(charityPool2.address);

                charityPool1.numberOfContributors.returns(200);
                charityPool2.numberOfContributors.returns(200);

                expect(await analytics.totalHelpers(iHelp.address, 0, 0)).to.equal(400);
            });

            it("should return the total number of helpers for a given charity", async () => {
                await iHelp.registerCharityPool(charityPool1.address);
                charityPool1.numberOfContributors.returns(200);

                expect(await analytics.totalHelpersInCharity(charityPool1.address)).to.equal(200);
            });


            it("should return the total user direct donations", async () => {
                await iHelp.registerCharityPool(charityPool1.address);
                await iHelp.registerCharityPool(charityPool2.address);


                await charityPool1.setVariable("_donationsRegistry", {
                    [addr1.address]: {
                        totalContribNativeToken: 0,
                        totalContribUSD: 20,
                        contribAfterSwapUSD: 0,
                        charityDonationUSD: 0,
                        devContribUSD: 0,
                        stakeContribUSD: 0
                    },
                    [addr2.address]: {
                        totalContribNativeToken: 0,
                        totalContribUSD: 20,
                        contribAfterSwapUSD: 0,
                        charityDonationUSD: 0,
                        devContribUSD: 0,
                        stakeContribUSD: 0
                    }
                });

                await charityPool2.setVariable("_donationsRegistry", {
                    [addr1.address]: {
                        totalContribNativeToken: 0,
                        totalContribUSD: 100,
                        contribAfterSwapUSD: 0,
                        charityDonationUSD: 0,
                        devContribUSD: 0,
                        stakeContribUSD: 0,
                        totalDonations: 0
                    },
                    [addr2.address]: {
                        totalContribNativeToken: 0,
                        totalContribUSD: 80,
                        contribAfterSwapUSD: 0,
                        charityDonationUSD: 0,
                        devContribUSD: 0,
                        stakeContribUSD: 0,
                        totalDonations: 0
                    }
                });

                expect(await analytics.getUserTotalDirectDonations(iHelp.address, addr1.address, 0, 0)).to.equal(120);
                expect(await analytics.getUserTotalDirectDonations(iHelp.address, addr2.address, 0, 0)).to.equal(100);
            });

            it("should return the total direct donations", async () => {
                await iHelp.registerCharityPool(charityPool1.address);
                await iHelp.registerCharityPool(charityPool2.address);

                charityPool1.totalDonationsUSD.returns(200);
                charityPool2.totalDonationsUSD.returns(200);

                expect(await analytics.getTotalDirectDonations(iHelp.address, 0, 0)).to.equal(400);
            });

            it("should return user donation statistics", async () => {
                await charityPool1.setVariable("_donationsRegistry", {
                    [addr1.address]: {
                        totalContribNativeToken: 0,
                        totalContribUSD: 20,
                        contribAfterSwapUSD: 0,
                        charityDonationUSD: 0,
                        devContribUSD: 0,
                        stakeContribUSD: 0
                    }
                });

                const result = await analytics.getUserDirectDonationsStats(charityPool1.address, addr1.address);
                expect(result.totalContribUSD).to.equal(20);
                expect(result.totalContribNativeToken).to.equal(0);
                expect(result.totalContribUSD).to.equal(20);
                expect(result.contribAfterSwapUSD).to.equal(0);
                expect(result.charityDonationUSD).to.equal(0);
                expect(result.devContribUSD).to.equal(0);
                expect(result.stakeContribUSD).to.equal(0);
            });
        })

        describe("Consolidated calls", () => {
            it("should return the general statistics in one call", async () => {
                await iHelp.registerCharityPool(charityPool1.address);
                await iHelp.registerCharityPool(charityPool2.address);

                charityPool1.accountedBalanceUSD.returns(200);
                charityPool2.accountedBalanceUSD.returns(200);

                charityPool1.calculateTotalInterestEarned.returns(20);
                charityPool2.calculateTotalInterestEarned.returns(30);

                charityPool1.numberOfContributors.returns(12);
                charityPool2.numberOfContributors.returns(8);

                const result = await analytics.generalStats(iHelp.address, 0, 0);

                expect(result.totalValueLocked).to.equal(400);
                expect(result.totalInterestGenerated).to.equal(50);
                expect(result.totalHelpers).to.equal(20);
            });

            it("should return the charity pool statistics in one call", async () => {
                charityPool1.accountedBalanceUSD.returns(12);
                charityPool1.totalInterestEarnedUSD.returns(22);
                charityPool1.numberOfContributors.returns(4);
                charityPool1.totalDonationsUSD.returns(5);
                
                const result = await analytics.charityStats(charityPool1.address);

                expect(result.totalValueLocked).to.equal(12);
                expect(result.totalYieldGenerated).to.equal(22);
                expect(result.numerOfContributors).to.equal(4);
                expect(result.totalDirectDonations).to.equal(5);
            });

            it("should return the user statistics in one call", async () => {
                await charityPool1.setVariable("_donationsRegistry", {
                    [addr1.address]: {
                        totalContribNativeToken: 0,
                        totalContribUSD: 20,
                        contribAfterSwapUSD: 0,
                        charityDonationUSD: 0,
                        devContribUSD: 0,
                        stakeContribUSD: 0,
                        totalDonations: 3
                    }
                });

                await charityPool2.setVariable("_donationsRegistry", {
                    [addr1.address]: {
                        totalContribNativeToken: 0,
                        totalContribUSD: 40,
                        contribAfterSwapUSD: 0,
                        charityDonationUSD: 0,
                        devContribUSD: 0,
                        stakeContribUSD: 0,
                        totalDonations: 7
                    }
                });

                iHelp.contirbutorGeneratedInterest.returns(25);

                await iHelp.registerCharityPool(charityPool1.address);
                await iHelp.registerCharityPool(charityPool2.address);

                const result = await analytics.userStats(iHelp.address, addr1.address, 0, 0);
                expect(result.totalDirectDonations).to.equal(10);
                expect(result.totalContributions).to.equal(60);
                expect(result.totalInterestGenerated).to.equal(50);

            });
        })
    });
});