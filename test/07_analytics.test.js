const { expect, use } = require("chai");

const { smock } = require("@defi-wonderland/smock");
const AggregatorInfoAbi = require('@chainlink/contracts/abi/v0.4/AggregatorV3Interface.json')

use(smock.matchers);

describe("Analytics", function () {
    let iHelp, analytics, charityPool1, charityPool2;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let developmentPool;
    let CTokenMock;
    let uMock1, uMock2, cTokenMock1, cTokenMock2;
    let priceFeedProviderMock, xhelpMock;
    let CompoundConnector, CharityPool, chainLinkAggretator;

    beforeEach(async () => {
        const IHelp = await smock.mock("iHelpToken");

        const Mock = await smock.mock("ERC20MintableMock");

        [owner, addr1, addr2, operator, stakingPool, developmentPool, swapperPool, ...addrs] = await ethers.getSigners();
        CTokenMock = await smock.mock("CTokenMock");

        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
        priceFeedProviderMock = await PriceFeedProvider.deploy();

        const WMock = await ethers.getContractFactory("WTokenMock");
        const Analytics = await ethers.getContractFactory("Analytics");

        analytics = await Analytics.deploy();
        uMock1 = await Mock.deploy("Mock", "MOK", 18);
        uMock2 = await Mock.deploy("Mock", "MOK", 18);
        mockContract = await Mock.deploy("Mock", "MOK", 18);

        xhelpMock = await Mock.deploy("xHelp", "XHLP", 18);

        cTokenMock1 = await CTokenMock.deploy(uMock1.address, 1000);
        cTokenMock2 = await CTokenMock.deploy(uMock2.address, 1000);

        const ProtocolConnector = await smock.mock("CompoundConnector");
        CompoundConnector = await ProtocolConnector.deploy();
        await CompoundConnector.initialize();
        chainLinkAggretator = await smock.fake(AggregatorInfoAbi);
        donationCurrencies = [{
            provider: "Provider1",
            currency: "eth",
            underlyingToken: uMock1.address,
            lendingAddress: cTokenMock1.address,
            priceFeed: chainLinkAggretator.address,
            connector: CompoundConnector.address
        }, {
            provider: "Provider2",
            currency: "eth",
            underlyingToken: uMock2.address,
            lendingAddress: cTokenMock2.address,
            priceFeed: chainLinkAggretator.address,
            connector: CompoundConnector.address
        }];

        await priceFeedProviderMock.initialize(donationCurrencies)
        priceFeedProviderMock.hasDonationCurrency.returns(true);

        iHelp = await IHelp.deploy();

        await iHelp.initialize(
            "iHelp",
            "IHLP",
            operator.address,
            developmentPool.address,
            mockContract.address,
            priceFeedProviderMock.address
        );

        holdingMock = await Mock.deploy("Mock", "MOK", 9);
        wTokenMock = await WMock.deploy();

        CharityPool = await smock.mock("CharityPool");

        charityPool1 = await CharityPool.deploy();
        charityPool2 = await CharityPool.deploy();

        charityPool1.calculateTotalInterestEarned.returns(20);

        await charityPool1.setVariable("operator", owner.address);
        await charityPool2.setVariable("operator", owner.address);

        charityPool1.getUnderlyingTokenPrice.returns([1e9, 9]);
        charityPool2.getUnderlyingTokenPrice.returns([1e9, 9]);

        await charityPool1.calculateTotalInterestEarned.returns(20);
        await charityPool2.calculateTotalInterestEarned.returns(30);
    });

    describe("Analytics testing", async () => {
        describe("Isolated calls", () => {
            it("should return the generated interest", async () => {
                await analytics.generatedInterest(charityPool1.address);
                expect(charityPool1.calculateTotalInterestEarned).to.have.been.called;
                await analytics.generatedInterest(charityPool2.address);
                expect(charityPool2.calculateTotalInterestEarned).to.have.been.called;

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
                await charityPool1.setVariable("priceFeedProvider", priceFeedProviderMock.address)
                await charityPool2.setVariable("priceFeedProvider", priceFeedProviderMock.address)

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

                await iHelp.setVariable("contributorGeneratedInterest", {
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

            it("should return the supported donation currencies", async () => {
                const currencies = await analytics.getSupportedCurrencies(iHelp.address);
                expect(currencies.length).to.equal(2);
                expect(currencies[0].provider).to.equal("Provider1");
                expect(currencies[0].underlyingToken).to.equal(uMock1.address);
                expect(currencies[0].lendingAddress).to.equal(cTokenMock1.address);
                expect(currencies[0].priceFeed).to.equal(chainLinkAggretator.address);

                expect(currencies[1].provider).to.equal("Provider2");
                expect(currencies[1].underlyingToken).to.equal(uMock2.address);
                expect(currencies[1].lendingAddress).to.equal(cTokenMock2.address);
                expect(currencies[1].priceFeed).to.equal(chainLinkAggretator.address);
            });
        })

        describe("Consolidated calls", () => {
            it("should return the general statistics in one call", async () => {
                await iHelp.registerCharityPool(charityPool1.address);
                await iHelp.registerCharityPool(charityPool2.address);

                charityPool1.accountedBalanceUSD.returns(200);
                charityPool2.accountedBalanceUSD.returns(200);

                charityPool1.totalInterestEarnedUSD.returns(20);
                charityPool2.totalInterestEarnedUSD.returns(30);

                iHelp.numberOfContributors.returns(20);

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
                await charityPool1.setVariable("priceFeedProvider", priceFeedProviderMock.address);
                await charityPool2.setVariable("priceFeedProvider", priceFeedProviderMock.address);

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

                await charityPool1.setVariable("balances", {
                    [addr1.address]: {
                        [cTokenMock1.address]: 10,
                        [cTokenMock2.address]: 15
                    }
                });

                await charityPool2.setVariable("balances", {
                    [addr1.address]: {
                        [cTokenMock1.address]: 10,
                        [cTokenMock2.address]: 15
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

                iHelp.contributorGeneratedInterest.returns(25);

                await iHelp.registerCharityPool(charityPool1.address);
                await iHelp.registerCharityPool(charityPool2.address);

                await charityPool1.setVariable("holdingDecimals", 18);
                await charityPool2.setVariable("holdingDecimals", 18);

                const result = await analytics.userStats(iHelp.address, addr1.address, 0, 0);
                expect(result.totalDirectDonations).to.equal(60);
                expect(result.totalContributions).to.equal(50);
                expect(result.totalInterestGenerated).to.equal(50);
                expect(result.totalDonationsCount).to.equal(10);

            });

            it("shoud get total contributions of charity pools", async () => {
                charityPool1.name.returns("Charity1");
                charityPool2.name.returns("Charity2");

                charityPool1.accountedBalanceUSD.returns(200);
                charityPool2.accountedBalanceUSD.returns(300);

                charityPool1.totalDonationsUSD.returns(5);
                charityPool2.totalDonationsUSD.returns(15);

                charityPool1.totalInterestEarnedUSD.returns(5);
                charityPool2.totalInterestEarnedUSD.returns(15);

                await iHelp.registerCharityPool(charityPool1.address);
                await iHelp.registerCharityPool(charityPool2.address);

                const [result1, result2] = await analytics.getCharityPoolsWithContributions(iHelp.address, 0, 0)
                expect(result1.charityName).to.equal("Charity1");
                expect(result1.charityAddress).to.equal(charityPool1.address);
                expect(result1.totalContributions).to.equal(200);
                expect(result1.totalDonations).to.equal(5);
                expect(result1.totalInterestGenerated).to.equal(5);

                expect(result2.charityName).to.equal("Charity2");
                expect(result2.charityAddress).to.equal(charityPool2.address);
                expect(result2.totalContributions).to.equal(300);
                expect(result2.totalDonations).to.equal(15);
                expect(result1.totalInterestGenerated).to.equal(5);
            })

            describe('Total user contributions in a given charity', () => {

                it("shoud get the total contributions of a user in a given charity", async () => {
                    charityPool1.name.returns("Charity1");
                    charityPool2.name.returns("Charity2");

                    await charityPool1.setVariable("_donationsRegistry", {
                        [owner.address]: {
                            totalContribNativeToken: 0,
                            totalContribUSD: 20,// -> We are intrested in this
                            contribAfterSwapUSD: 0,
                            charityDonationUSD: 0,
                            devContribUSD: 0,
                            stakeContribUSD: 0,
                            totalDonations: 3
                        }
                    });

                    await charityPool2.setVariable("_donationsRegistry", {
                        [owner.address]: {
                            totalContribNativeToken: 0,
                            totalContribUSD: 40, // -> We are intrested in this
                            contribAfterSwapUSD: 0,
                            charityDonationUSD: 0,
                            devContribUSD: 0,
                            stakeContribUSD: 0,
                            totalDonations: 7
                        }
                    });

                    await iHelp.setVariable("contributorGeneratedInterest", {
                        [addr1.address]: {
                            [charityPool1.address]: 10,
                            [charityPool2.address]: 20
                        },
                        [addr2.address]: {
                            [charityPool1.address]: 5,
                            [charityPool2.address]: 5
                        }
                    });

                    await charityPool1.setVariable("balances", {
                        [owner.address]: {
                            [cTokenMock1.address]: 20,
                            [cTokenMock2.address]: 50
                        }
                    })

                    charityPool1.balanceOfUSD.returns(200);
                    charityPool2.balanceOfUSD.returns(300);
                    charityPool1.getAllDonationCurrencies.returns(donationCurrencies);
                    charityPool2.getAllDonationCurrencies.returns(donationCurrencies);

                    await iHelp.registerCharityPool(charityPool1.address);
                    await iHelp.registerCharityPool(charityPool2.address);


                    const [result1, result2] = await analytics.getUserContributionsPerCharity(iHelp.address, owner.address, 0, 0)

                    expect(result1.charityName).to.equal("Charity1");
                    expect(result1.charityAddress).to.equal(charityPool1.address);
                    expect(result1.totalContributions).to.equal(200);
                    expect(result1.totalDonations).to.equal(20);

                    expect(result1.tokenStatistics.length).to.equal(2);
                    expect(result1.tokenStatistics[0].tokenAddress).to.equal(cTokenMock1.address);
                    expect(result1.tokenStatistics[0].totalContributions).to.equal(20);
                    expect(result1.tokenStatistics[1].tokenAddress).to.equal(cTokenMock2.address);
                    expect(result1.tokenStatistics[1].totalContributions).to.equal(50);


                    expect(result2.charityName).to.equal("Charity2");
                    expect(result2.charityAddress).to.equal(charityPool2.address);
                    expect(result2.totalContributions).to.equal(300);
                    expect(result2.totalDonations).to.equal(40);

                    expect(result2.tokenStatistics.length).to.equal(2);
                    expect(result2.tokenStatistics[0].tokenAddress).to.equal(cTokenMock1.address);
                    expect(result2.tokenStatistics[0].totalContributions).to.equal(0);
                    expect(result2.tokenStatistics[1].tokenAddress).to.equal(cTokenMock2.address);
                    expect(result2.tokenStatistics[1].totalContributions).to.equal(0);
                })
            })


            it("shoud get the charities with their holding token balances", async () => {
                charityPool1.name.returns("Charity1");
                charityPool2.name.returns("Charity2");

                await mockContract.setVariable('_balances', {
                    [charityPool1.address]: 10,
                    [charityPool2.address]: 20,

                })
                charityPool1.balanceOfUSD.returns(200);
                charityPool2.balanceOfUSD.returns(300);


                await iHelp.registerCharityPool(charityPool1.address);
                await iHelp.registerCharityPool(charityPool2.address);

                const [result1, result2] = await analytics.getCharityPoolsAddressesAndBalances(iHelp.address, 0, 0)
                expect(result1.charityName).to.equal("Charity1");
                expect(result1.charityAddress).to.equal(charityPool1.address);
                expect(result1.balance).to.equal(10);

                expect(result2.charityName).to.equal("Charity2");
                expect(result2.charityAddress).to.equal(charityPool2.address);
                expect(result2.balance).to.equal(20);
            })

            it("shoud get the staking pool state", async () => {
                charityPool1.name.returns("Charity1");
                charityPool2.name.returns("Charity2");

                iHelp.totalCirculating.returns(200);
                iHelp.balanceOf.returns(100)

                const result = await analytics.stakingPoolState(iHelp.address, owner.address)
                expect(result.iHelpTokensInCirculation).to.equal(200);
                expect(result.iHelpStaked).to.equal(100);
            })

            it("should return the suppored donation currencies user balance", async () => {
                uMock1.balanceOf.returns(15);
                uMock2.balanceOf.returns(30);

                const result = await analytics.getUserWalletBalances(iHelp.address, owner.address);
                expect(result.length).to.equal(2);
                expect(result[0].balance).to.equal(15);
                expect(result[1].balance).to.equal(30);
            })

            it("should return the suppored donation currencies user contributions per charity", async () => {
                uMock1.balanceOf.returns(15);
                uMock2.balanceOf.returns(30);

                const result = await analytics.getUserWalletBalances(iHelp.address, owner.address);
                expect(result.length).to.equal(2);
                expect(result[0].balance).to.equal(15);
                expect(result[1].balance).to.equal(30);
            })

            it("should return user token contributions per charity", async () => {
                await charityPool1.setVariable("balances", {
                    [owner.address]: {
                        [cTokenMock1.address]: 20,
                        [cTokenMock2.address]: 50
                    }
                })

                await charityPool1.setVariable("priceFeedProvider", priceFeedProviderMock.address);
                await charityPool2.setVariable("priceFeedProvider", priceFeedProviderMock.address);

                const result = await analytics.getUserTokenContributionsPerCharity(charityPool1.address, owner.address);
                expect(result.length).to.equal(2);
                expect(result[0].totalContributions).to.equal(20);
                expect(result[0].tokenAddress).to.equal(cTokenMock1.address);

                expect(result[1].totalContributions).to.equal(50)
                expect(result[1].tokenAddress).to.equal(cTokenMock2.address);

            })

            it("should return user token donations per charity", async () => {
                await charityPool1.setVariable("donationBalances", {
                    [owner.address]: {
                        [cTokenMock1.address]: 25,
                        [cTokenMock2.address]: 75
                    }
                })

                await charityPool1.setVariable("priceFeedProvider", priceFeedProviderMock.address);
                await charityPool2.setVariable("priceFeedProvider", priceFeedProviderMock.address);

                const result = await analytics.getUserTokenDonationsPerCharity(charityPool1.address, owner.address);
                expect(result.length).to.equal(2);
                expect(result[0].totalContributions).to.equal(25);
                expect(result[0].tokenAddress).to.equal(cTokenMock1.address);

                expect(result[1].totalContributions).to.equal(75)
                expect(result[1].tokenAddress).to.equal(cTokenMock2.address);
            })

            it("should return user token allowances per charity", async () => {
                await uMock1.increaseAllowance(charityPool1.address, 1000);
                await uMock2.increaseAllowance(charityPool1.address, 1000);

                await charityPool1.setVariable("priceFeedProvider", priceFeedProviderMock.address);
                await charityPool2.setVariable("priceFeedProvider", priceFeedProviderMock.address);

                const result = await analytics.getDonationCurrencyAllowances(charityPool1.address, owner.address);
                expect(result.length).to.equal(2);
                expect(result[0].allowance).to.equal(1000);
                expect(result[0].tokenAddress).to.equal(uMock1.address);

                expect(result[1].allowance).to.equal(1000)
                expect(result[1].tokenAddress).to.equal(uMock2.address);
            })
            it("should return the iHelp wallet info", async () => {

                await iHelp.setVariable("_balances", {
                    [owner.address]: 100
                })

                await xhelpMock.setVariable("_balances", {
                    [owner.address]: 100
                })

                await iHelp.approve(xhelpMock.address, 100);

                const result = await analytics.walletInfo(
                    iHelp.address,
                    owner.address,
                    xhelpMock.address
                );
                expect(result.iHelpBalance).to.equal(100)
                expect(result.xHelpBalance).to.equal(100)
                expect(result.stakingAllowance).to.equal(100)
            })

            it("should return the contributors of a charity", async () => {

                charityPool1.numberOfContributors.returns(2);
                await charityPool1.setVariable("priceFeedProvider", priceFeedProviderMock.address);
                await charityPool1.setVariable("ihelpToken", iHelp.address);

                await charityPool1.setVariable("_donationsRegistry", {
                    [addr1.address]: {
                        totalContribNativeToken: 0,
                        totalContribUSD: 20,
                        totalDonations: 5,
                        contribAfterSwapUSD: 0,
                        charityDonationUSD: 0,
                        devContribUSD: 0,
                        stakeContribUSD: 0
                    },
                    [addr2.address]: {
                        totalContribNativeToken: 0,
                        totalContribUSD: 25,
                        totalDonations: 2,
                        contribAfterSwapUSD: 0,
                        charityDonationUSD: 0,
                        devContribUSD: 0,
                        stakeContribUSD: 0
                    },

                });

                await iHelp.setVariable("contributorGeneratedInterest", {
                    [addr1.address]: {
                        [charityPool1.address]: 10,
                    },
                    [addr2.address]: {
                        [charityPool1.address]: 10,
                    },
                });

                charityPool1.contributorAt.returns(args => {
                    const a = [
                        addr1.address,
                        addr2.address
                    ]
                    return (a[args[0]])
                });

                const result = await analytics.getContributorsPerCharity(charityPool1.address, 0, 0);

                console.log(result);
                expect(result[0].contributorAddress).to.equal(addr1.address);
                expect(result[0].totalContributions).to.equal("0");
                expect(result[0].totalDonations).to.equal("20");
                expect(result[0].totalDonationsCount).to.equal("5");
                expect(result[0].totalInterestGenerated).to.equal("10");

                expect(result[1].contributorAddress).to.equal(addr2.address);
                expect(result[1].totalContributions).to.equal("0");
                expect(result[1].totalDonations).to.equal("25");
                expect(result[1].totalDonationsCount).to.equal("2");
                expect(result[1].totalInterestGenerated).to.equal("10");

            })
        })
    });
});