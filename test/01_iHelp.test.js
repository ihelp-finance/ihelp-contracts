const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { parseEther } = require('ethers/lib/utils');

use(smock.matchers);

describe("iHelp", function () {
    let iHelp;
    let owner;
    let addr1;
    let addr2;
    let addr3;
    let addrs;
    let cTokenMock;
    let stakingPool, cTokenUnderlyingMock, developmentPool;
    let priceFeedProvider, contributionsAggregator


    beforeEach(async function () {
        const IHelp = await smock.mock("iHelpToken");
        const Mock = await smock.mock("ERC20MintableMock");
        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock", {
            signer: owner
        });

        [owner, addr1, addr2, addr3, stakingPool, developmentPool, operator, ...addrs] = await ethers.getSigners();
        const CTokenMock = await smock.mock("CTokenMock");

        cTokenUnderlyingMock = await Mock.deploy("Mock", "MOK", 18);
        cTokenMock = await CTokenMock.deploy(cTokenUnderlyingMock.address, 10000);

        priceFeedProvider = await PriceFeedProvider.deploy();

        contributionsAggregator = await smock.fake("ContributionsAggregatorExtended");
        iHelp = await IHelp.deploy();

        await iHelp.initialize(
            "iHelp",
            "IHLP",
            operator.address,
            developmentPool.address,
            cTokenUnderlyingMock.address,
            priceFeedProvider.address
        );

        await iHelp.setStakingPool(
            stakingPool.address
        );

        await iHelp.setContributionsAggregator(
            contributionsAggregator.address
        );
    });

    describe("Deployment", function () {
        it("Should set the right operator", async function () {
            expect(await iHelp.operator()).to.equal(operator.address);
        });

        it("Should set the right reward token", async function () {
            expect(await iHelp.underlyingToken()).to.equal(cTokenUnderlyingMock.address);
        });

        it("Should set the right staking pool", async function () {
            expect(await iHelp.stakingPool()).to.equal(stakingPool.address);
        });

        it("Should set the right holding pool", async function () {
            expect(await iHelp.developmentPool()).to.equal(developmentPool.address);
        });

        it("Should set correct tokens minted per phase", async function () {
            expect(await iHelp.__tokensMintedPerPhase()).to.be.equal(1000000);
        });

        it("Should set correct developmentShareOfInterest", async function () {
            expect(await iHelp.developmentShareOfInterest()).to.be.equal((100).toFixed());
        });

        it("Should set correct stakingShareOfInterest", async function () {
            expect(await iHelp.stakingShareOfInterest()).to.be.equal((100).toFixed());
        });

        it("Should set correct __tokensMintedPerPhase", async function () {
            expect(await iHelp.__tokensMintedPerPhase()).to.be.equal(1000000);
        });

        it("Should set correct __totalCirculating", async function () {
            expect(await iHelp.__totalCirculating()).to.be.equal(0);
        });

        it("Should set correct __tokenPhase", async function () {
            expect(await iHelp.__tokenPhase()).to.be.equal(1);
        });

        it("Should set correct __lastProcessedInterestUSD", async function () {
            expect(await iHelp.__lastProcessedInterestUSD()).to.be.equal(0);
        });

        it("Should set correct __tokensLastDripped", async function () {
            expect(await iHelp.__tokensLastDripped()).to.be.equal(0);
        });

        it("Should mint operator balance", async function () {
            expect(await iHelp.balanceOf(operator.address).then(data => Number(data) / 1e18)).to.equal(1000000);
        });

        it("Should mint development pool balance", async function () {
            expect(await iHelp.balanceOf(developmentPool.address).then(data => Number(data) / 1e18)).to.equal(10000000);
        });

        it("Should set the correct price feed provider address", async function () {
            expect(await iHelp.priceFeedProvider()).to.equal(priceFeedProvider.address);
        });
    });

    describe("Setters", function () {
        describe("Testing setTokenPhase", function () {
            it("Should revert when not called by owner or operator", async function () {
                await expect(iHelp.connect(addr1).setTokenPhase(2)).to.be.revertedWith("Funding/is-operator-or-owner");
            });

            it("Should set token phase when called by owner", async function () {
                await iHelp.setTokenPhase(2);
                expect(await iHelp.__tokenPhase()).to.equal(2);
            });

            it("Should set token phase when called by operator", async function () {
                await iHelp.connect(operator).setTokenPhase(2);
                expect(await iHelp.__tokenPhase()).to.equal(2);
            });

            it("Should transfer the operator ", async function () {
                await iHelp.transferOperator(addr1.address);
                expect(await iHelp.operator()).to.equal(addr1.address);
            });

            it("Should fail to transfer the operator to null", async function () {
                await expect(iHelp.transferOperator(0)).to.be.reverted;
            });
        });

        it("Should set cumulativeInterestByPhase", async function () {
            await iHelp.setCumulativeEmissionRate(0, 2);
            expect(await iHelp.cumulativeInterestByPhase(0)).to.equal(2);
        });

        it("Should only allow operator or owner to set the cumulativeInterestByPhase", async function () {
            await expect(iHelp.connect(addr1).setCumulativeEmissionRate(0, 2)).to.be.reverted;
        });

        it("Should set tokensPerInterestByPhase", async function () {
            await iHelp.setTokensPerInterestPhase(0, 2);
            expect(await iHelp.tokensPerInterestByPhase(0)).to.equal(2);
        });

        it("Should only allow operator or owner to set the tokensPerInterestByPhase", async function () {
            await expect(iHelp.connect(addr1).setCumulativeEmissionRate(0, 2)).to.be.reverted;
        });
    });


    describe("Charity pool management", function () {
        describe("Testing registerCharityPool", function () {
            it("Should revert when not called by owner or operator", async function () {
                await expect(iHelp.connect(addr1).registerCharityPool(addr2.address)).to.be.revertedWith("Funding/is-operator-or-owner");
            });

            it("Should register a new charity pool", async function () {
                await iHelp.registerCharityPool(addr2.address);
                expect(await iHelp.numberOfCharities()).to.equal(1);
            });

            it("Should bulk register  new charity pools", async function () {
                await iHelp.bulkRegisterCharityPools([addr2.address, addr1.address]);
                expect(await iHelp.numberOfCharities()).to.equal(2);
            });
        });

        describe("Testing deregisterCharityPool", function () {
            it("Should revert when not called by owner or operator", async function () {
                await expect(iHelp.connect(addr1).deregisterCharityPool(addr2.address)).to.be.revertedWith("Funding/is-operator-or-owner");
            });

            it("Should deregister a new charity pool", async function () {
                await iHelp.registerCharityPool(addr2.address);
                await iHelp.deregisterCharityPool(addr2.address);

                expect(await iHelp.numberOfCharities()).to.equal(0);
            });
        });


        it("Should calculate the total interest earned by the charity pools", async function () {
            const CharityPool = await smock.mock('CharityPool');
            const charityPool1 = await CharityPool.deploy();
            const charityPool2 = await CharityPool.deploy();

            await charityPool1.setVariable('operator', owner.address);
            await charityPool2.setVariable('operator', owner.address);

            donationCurrencies = [{
                provider: "Provider1",
                underlyingToken: cTokenUnderlyingMock.address,
                lendingAddress: cTokenMock.address,
                currency: "currency1",
                priceFeed: addrs[5].address,
                connector: addrs[6].address,
            }]

            priceFeedProvider.getAllDonationCurrencies.returns(donationCurrencies);

            await charityPool1.setVariable('totalInterestEarned', {
                [cTokenMock.address]: 20
            });

            await charityPool2.setVariable('totalInterestEarned', {
                [cTokenMock.address]: 40
            });

            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);

            expect(await iHelp.getTotalCharityPoolInterest()).to.equal(60);
        });
    });

    describe("Upkeep", function () {
        let charityPool1;
        let charityPool2;

        beforeEach(async function () {
            const CharityPool = await smock.mock('CharityPool');
            charityPool1 = await CharityPool.deploy();
            charityPool2 = await CharityPool.deploy();

            donationCurrencies = [{
                provider: "Provider1",
                underlyingToken: cTokenUnderlyingMock.address,
                lendingAddress: cTokenMock.address,
                currency: "currency1",
                priceFeed: addrs[5].address,
                connector: addrs[6].address,
            }, {
                provider: "Provider2",
                underlyingToken: cTokenUnderlyingMock.address,
                lendingAddress: cTokenMock.address,
                currency: "currency1",
                priceFeed: addrs[5].address,
                connector: addrs[6].address,
            }]

            await priceFeedProvider.getAllDonationCurrencies.returns(donationCurrencies);

            console.log("Registering charities", charityPool1.address, charityPool2.address)
            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);
        });

        it('should redeem interest, drip and distribute', async () => {
            contributionsAggregator.redeemInterest.returns(5);
            await iHelp.upkeep();
            const tokensToCirculate = contributionsAggregator.distributeIHelp.getCall(0).args[0]
            expect(tokensToCirculate / 1e18).to.be.closeTo(16.66, 0.01);
        })

        it('should redeem interest, and calculate phase change', async () => {
            contributionsAggregator.redeemInterest.returns(5);
            await iHelp.setVariable('__totalSupply', parseEther('10'))
            await iHelp.upkeep();
            const tokensToCirculate = contributionsAggregator.distributeIHelp.getCall(0).args[0]
            expect(tokensToCirculate / 1e18).to.be.closeTo(13.33, 0.01);
        })

    });

    describe("Tokens claiming", function () {
        beforeEach(async function () {
            await iHelp.setVariable('contributorTokenClaims', {
                [owner.address]: 200
            });
        });

        it("Should claim tokens", async function () {
            const mockCharityAddress = addr1.address;
            await iHelp.claimTokens();
            expect(await iHelp.contributorTokenClaims(mockCharityAddress)).to.equal(0);
        });
    });

    describe("Getters", function () {
        it("Should return the totalCirculating", async function () {
            await iHelp.setVariable("__totalCirculating", 2);
            expect(await iHelp.__totalCirculating()).to.equal(2);
        });

        it("Should return the totalAvailableSupply", async function () {
            await iHelp.setVariable("__totalSupply", 2);
            expect(await iHelp.__totalSupply()).to.equal(2);
        });

        it("Should return the tokensLastDripped", async function () {
            await iHelp.setVariable("__tokensLastDripped", 2);
            expect(await iHelp.tokensLastDripped()).to.equal(2);
        });

        it("Should return the claimableTokens", async function () {
            await iHelp.setVariable("contributorTokenClaims", {
                [owner.address]: 2
            });
            expect(await iHelp.claimableTokens()).to.equal(2);
        });

        it("Should return the balance", async function () {
            await iHelp.setVariable("_balances", {
                [owner.address]: 2
            });
            expect(await iHelp.balanceOf(owner.address)).to.equal(2);
        });

        it("Should return correct sender balance", async function () {
            await iHelp.setVariable("_balances", {
                [owner.address]: 2
            });
            expect(await iHelp.balance()).to.equal(2);
        });

        it("Should return correct interestPerTokenByPhase", async function () {
            await iHelp.setVariable("__tokensMintedPerPhase", 2);
            await iHelp.setVariable("cumulativeInterestByPhase", {
                [1]: 20
            });
            expect(await iHelp.interestPerTokenByPhase(1)).to.equal((10 * 1e18).toFixed());
        });

        it("Should return correct interestGenerated", async function () {
            await iHelp.setVariable("__interestGenerated", 2);
            expect(await iHelp.interestGenerated()).to.equal(2);
        });

        it("Should return correct __tokensMintedPerPhase", async function () {
            await iHelp.setVariable("__tokensMintedPerPhase", 2);
            expect(await iHelp.__tokensMintedPerPhase()).to.equal(2);
        });

        it("Should return correct currentTokensPerInterest", async function () {
            await iHelp.setVariable("__tokenPhase", 1);
            await iHelp.setVariable("tokensPerInterestByPhase", {
                [1]: 20
            });
            expect(await iHelp.currentTokensPerInterest()).to.equal(20);
        });
    });

    describe("Contributor counter", function () {
        it('should increase the number of contributors', async function () {
            await iHelp.registerCharityPool(owner.address);
            console.log(await iHelp.hasCharity(owner.address));
            await iHelp.notifyBalanceUpdate(owner.address, 200, true);
            expect(await iHelp.numberOfContributors()).to.equal(1);
        })

        it('should dencrease the number of contributors', async function () {
            await iHelp.registerCharityPool(owner.address);
            await iHelp.notifyBalanceUpdate(owner.address, 200, true);
            await iHelp.notifyBalanceUpdate(owner.address, 200, false);
            expect(await iHelp.numberOfContributors()).to.equal(0);
        })
    })

    describe("Bulk withdrawals counter", function () {
        let charityPool1, charityPool2;

        beforeEach(async function () {
            charityPool1 = await smock.fake('CharityPool');
            charityPool2 = await smock.fake('CharityPool');
        })

        it('call withdraw all on 2 charities', async function () {
            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);

            await iHelp.withdrawBulk([charityPool1.address, charityPool2.address]);

            expect(charityPool1.withdrawAll).to.be.calledOnce;
            expect(charityPool2.withdrawAll).to.be.calledOnce
        })
    })

});















