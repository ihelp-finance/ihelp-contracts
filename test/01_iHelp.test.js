const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const BigNumber = require('big.js');
const { abi } = require("../artifacts/contracts/ihelp/Swapper.sol/Swapper.json");

use(smock.matchers);

describe("iHelp", function () {
    let iHelp;
    let owner;
    let addr1;
    let addr2;
    let addr3;
    let addrs;
    let cTokenMock;
    let stakingPool, cTokenUnderlyingMock, developmentPool, holdingPool;
    let priceFeedProvider;


    beforeEach(async function () {
        const IHelp = await smock.mock("iHelpToken");
        const Mock = await smock.mock("ERC20MintableMock");
        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");

        [owner, addr1, addr2, addr3, stakingPool, developmentPool, holdingPool, operator, ...addrs] = await ethers.getSigners();
        const CTokenMock = await smock.mock("CTokenMock");

        cTokenUnderlyingMock = await Mock.deploy("Mock", "MOK", 18);
        cTokenMock = await CTokenMock.deploy(cTokenUnderlyingMock.address, 10000);

        priceFeedProvider = await PriceFeedProvider.deploy();

        // mockContract = await Mock.deploy("Mock", "MOK", 18);
        iHelp = await IHelp.deploy();

        await iHelp.initialize(
            "iHelp",
            "IHLP",
            operator.address,
            stakingPool.address,
            developmentPool.address,
            holdingPool.address,
            // TODO: Is the  cTokenUnderlyingMock == holdingTOken
            cTokenUnderlyingMock.address,
            priceFeedProvider.address
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
            expect(await iHelp.holdingPool()).to.equal(holdingPool.address);
        });

        it("Should set the right holding pool", async function () {
            expect(await iHelp.developmentPool()).to.equal(developmentPool.address);
        });

        it("Should set correct tokens minted per phase", async function () {
            expect(await iHelp.__tokensMintedPerPhase()).to.be.equal(1000000);
        });

        it("Should set correct developmentShareOfInterest", async function () {
            expect(await iHelp.developmentShareOfInterest()).to.be.equal((500).toFixed());
        });

        it("Should set correct stakingShareOfInterest", async function () {
            expect(await iHelp.stakingShareOfInterest()).to.be.equal((500).toFixed());
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
            expect(await iHelp.balanceOf(developmentPool.address).then(data => Number(data) / 1e18)).to.equal(7000000);
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

        it("Should set the __processingGasLimit", async function () {
            await iHelp.connect(operator).setProcessingGasLimit(2);
            expect(await iHelp.__processingGasLimit()).to.equal(2);
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
                expect(await iHelp.__charityPoolRegistry(addr2.address)).to.not.equal('0x0000000000000000000000000000000000000000');

                expect(await iHelp.numberOfCharities()).to.equal(1);
            });
        });

        describe("Testing deregisterCharityPool", function () {
            it("Should revert when not called by owner or operator", async function () {
                await expect(iHelp.connect(addr1).deregisterCharityPool(addr2.address)).to.be.revertedWith("Funding/is-operator-or-owner");
            });

            it("Should deregister a new charity pool", async function () {
                await iHelp.registerCharityPool(addr2.address);
                await iHelp.deregisterCharityPool(addr2.address);
                expect(await iHelp.__charityPoolRegistry(addr2.address)).to.equal('0x0000000000000000000000000000000000000000');

                expect(await iHelp.numberOfCharities()).to.equal(0);
            });
        });


        it("Should calculate the total interest earned by the charity pools", async function () {
            const CharityPool = await smock.mock('CharityPool');
            const charityPool1 = await CharityPool.deploy();
            const charityPool2 = await CharityPool.deploy();

            const swapper = await smock.fake(abi);
            swapper.getAmountsOutByPath.returns(args => args[1]);
            swapper.swap.returns(args => args[2]);


            await charityPool1.setVariable('swapper', swapper.address);
            await charityPool2.setVariable('swapper', swapper.address);

            await charityPool1.setVariable('operator', owner.address);
            await charityPool2.setVariable('operator', owner.address);

            donationCurrencies = [{
                provider: "Provider1",
                underlyingToken: cTokenUnderlyingMock.address,
                lendingAddress: cTokenMock.address,
                priceFeed: addr3.address
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

    describe("Drips and dumps", function () {
        let charityPool1;
        let charityPool2;

        beforeEach(async function () {
            const CharityPool = await smock.mock('CharityPool');
            charityPool1 = await CharityPool.deploy();
            charityPool2 = await CharityPool.deploy();

            const swapper = await smock.fake(abi);
            swapper.getAmountsOutByPath.returns(args => args[1]);
            swapper.swap.returns(args => args[2]);


            await charityPool1.setVariable('swapper', swapper.address);
            await charityPool2.setVariable('swapper', swapper.address);

            await charityPool1.setVariable('holdingToken', cTokenUnderlyingMock.address);
            await charityPool2.setVariable('holdingToken', cTokenUnderlyingMock.address);

            await charityPool1.setVariable('operator', owner.address);
            await charityPool2.setVariable('operator', owner.address);
            donationCurrencies = [{
                provider: "Provider1",
                underlyingToken: cTokenUnderlyingMock.address,
                lendingAddress: cTokenMock.address,
                priceFeed: addr3.address
            }]

            priceFeedProvider.getAllDonationCurrencies.returns(donationCurrencies);


            await charityPool2.setVariable("balances", {
                [owner.address]: {
                    [cTokenMock.address]: 100
                },
                [addr1.address]: {
                    [cTokenMock.address]: 100
                }
            });

            await charityPool1.setVariable("balances", {
                [owner.address]: {
                    [cTokenMock.address]: 100
                },
                [addr1.address]: {
                    [cTokenMock.address]: 100
                }
            });

            console.log("Registering charities", charityPool1.address, charityPool2.address)
            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);

            charityPool1.calculateTotalIncrementalInterest.returns();
            charityPool2.calculateTotalIncrementalInterest.returns();

            charityPool1.newTotalInterestEarnedUSD.returns(200);
            charityPool2.newTotalInterestEarnedUSD.returns(200);

            charityPool2.accountedBalanceUSD.returns(200);
            charityPool1.accountedBalanceUSD.returns(200);
        });

        describe("Drip stage 1", async function () {
            it("Should set the correct status", async function () {
                // Fetch the current  drip status
                await iHelp.dripStage1();

                const { status, i, ii } = await iHelp.processingState();
                expect(status).to.equal(1);
                expect(i).to.equal(0);
                expect(ii).to.equal(0);
            });

            it("Should set correct generated interest", async function () {
                await iHelp.dripStage1();

                expect(await iHelp.charityInterestShare(charityPool1.address)).to.equal(200);
                expect(await iHelp.charityInterestShare(charityPool2.address)).to.equal(200);
                const { newInterestUS } = await iHelp.processingState();
                expect(newInterestUS).to.equal(400);
            });


            it("Should not allow re-entry", async function () {
                await iHelp.dripStage1();

                // Cannot go back to drip stage 1 have to move forward
                await expect(iHelp.dripStage1()).to.be.reverted;
            });

            describe("Upkeep -- dripStage1", function () {
                it("Should set processing state", async function () {
                    await iHelp.setProcessiongState(1, 1, 1, 1, 1, 1, 1);
                    const processingState = await iHelp.processingState();
                    for (const val of Object.values(processingState)) {
                        expect(val).to.be.equal(1);
                    }
                });

                it("Should save contract state when running out of gas dp1", async function () {
                    await iHelp.setProcessingGasLimit(25_000);
                    await iHelp.dripStage1();

                    let state = await iHelp.processingState();

                    expect(state.i).to.equal(1);
                    await expect(iHelp.dripStage2()).to.be.reverted;
                    await iHelp.dripStage1();
                    state = await iHelp.processingState();

                    expect(state.status).to.equal(1);
                    expect(state.i).to.equal(0);
                    expect(state.ii).to.equal(0);
                });
            });
        });

        describe("Drip stage 2", async function () {
            it("Should run dripStage2", async function () {
                await iHelp.dripStage1();
                // Call drip stage 2
                await iHelp.dripStage2();

                // Fetch the current  drip status
                const { status } = await iHelp.processingState();

                // Cannot go back to drip stage 1 have to move forward
                await expect(iHelp.dripStage2()).to.be.reverted;

                expect(status).to.equal(3);
                let expectedTokensToCirculate = new BigNumber(400).mul(1.66666666666);

                const { tokensToCirculateInCurrentPhase, tokensToCirculate } = await iHelp.processingState();
                expect(tokensToCirculateInCurrentPhase).to.equal(0);
                expect(tokensToCirculate).to.equal(expectedTokensToCirculate.toFixed(0, 3));
            });

            it("Should set the correct __totalSupply", async function () {
                await iHelp.dripStage1();
                const intialSupply = await iHelp.__totalSupply();
                let tokensToCirculate = new BigNumber(400).mul(1.66666666666);
                await iHelp.dripStage2();

                console.log(intialSupply.toString(), tokensToCirculate.toFixed(0, 3));
                expect(await iHelp.__totalSupply()).to.equal(intialSupply.sub(tokensToCirculate.toFixed(0, 3)));
            });

            it("Should set the correct __totalCirculating", async function () {
                await iHelp.dripStage1();
                const initialTOtalCirculating = await iHelp.__totalCirculating();
                let tokensToCirculate = new BigNumber(400).mul(1.66666666666);
                await iHelp.dripStage2();
                expect(await iHelp.__totalCirculating()).to.equal(initialTOtalCirculating.add(tokensToCirculate.toFixed(0, 3)));
            });

            it("Should set the correct __tokensLastDripped", async function () {
                await iHelp.dripStage1();
                let tokensToCirculate = new BigNumber(400).mul(1.66666666666);
                await iHelp.dripStage2();
                expect(await iHelp.__tokensLastDripped()).to.equal(tokensToCirculate.toFixed(0, 3));
            });

            it("Should run dripStage2, and set status to 2", async function () {

                const tokensPerIntereset = new BigNumber(10000000000000000000000).mul(1e18).toFixed();
                await iHelp.setVariable('tokensPerInterestByPhase', {
                    1: tokensPerIntereset
                });

                await iHelp.dripStage1();
                const intialSupply = await iHelp.__totalSupply();
                await iHelp.dripStage2();

                // Cannot go back to drip stage 1 have to move forward
                await expect(iHelp.dripStage2()).to.be.reverted;

                // Fetch the current  drip status
                const { tokensToCirculateInCurrentPhase, tokensToCirculate, status } = await iHelp.processingState();
                expect(tokensToCirculateInCurrentPhase).to.equal(intialSupply);

                expect(status).to.equal(2);
                expect(await iHelp.__tokenPhase()).to.equal(2);
            });
        });


        describe("Drip stage 4", async function () {

            beforeEach(async function () {
                charityPool1.getContributors.returns([addr1.address, addr2.address]);
                charityPool2.getContributors.returns([addr1.address, addr2.address]);

                charityPool1.balanceOfUSD.returns(20);
                charityPool2.balanceOfUSD.returns(40);
            });

            it("Should call distribute", async function () {
                await iHelp.dripStage1();
                await iHelp.dripStage2();

                const { totalCharityPoolContributions, tokensToCirculate } = await iHelp.processingState();
                const contribution1 = await charityPool1.accountedBalanceUSD();

                const share1 = contribution1 / totalCharityPoolContributions;
                const poolTokens1 = share1 * tokensToCirculate;

                console.log("\n");
                console.log(totalCharityPoolContributions.toString(), "totalCharityPoolContributions");
                console.log(contribution1.toString(), "contribution pool 1");
                console.log(share1.toString(), "pool share1");
                console.log(poolTokens1, "poolTokens1");

                const contribution2 = await await charityPool2.accountedBalanceUSD();

                const share2 = contribution2 / totalCharityPoolContributions;
                const poolTokens2 = share2 * tokensToCirculate;

                console.log(contribution2.toString(), "contribution pool 1");
                console.log(share2.toString(), " pool share2");
                console.log(poolTokens2, "poolTokens2");


                // User sahre is the pool balance in BUSD deveided by the pool contributution
                const userSharePool1 = 20 / contribution1;
                const userSharePool2 = 40 / contribution2;

                const contributionTokens1 = userSharePool1 * poolTokens1;
                const contributionTokens2 = userSharePool2 * poolTokens2;


                await expect(iHelp.dripStage4()).to.not.be.reverted;
                const userTokenClaim = await iHelp.contributorTokenClaims(addr1.address);
                const totalUserTokenClaimCharity1 = await iHelp.contirbutorGeneratedInterest(addr1.address, charityPool1.address);
                const totalUserTokenClaimCharity2 = await iHelp.contirbutorGeneratedInterest(addr1.address, charityPool2.address);

                // Should keep track of the total claimable tokens
                expect(totalUserTokenClaimCharity1).to.equal((contributionTokens1).toFixed());
                expect(totalUserTokenClaimCharity2).to.equal((contributionTokens2).toFixed());

                // Check that the total contribution was added correctly
                expect(userTokenClaim).to.equal((contributionTokens1 + contributionTokens2).toFixed());
            });

            describe("Upkeep -- dripStage4", function () {
                it("Should save contract state when running out of gas", async function () {
                    await iHelp.dripStage1();
                    await iHelp.dripStage2();

                    await iHelp.setProcessingGasLimit(24_000);
                    await iHelp.dripStage4();
                    let state = await iHelp.processingState();

                    expect(state.status).to.equal(3);
                    expect(state.i).to.equal(0);
                    expect(state.ii).to.equal(1);

                    console.log(state.status, state.i, state.ii);
                    await iHelp.dripStage4();
                    state = await iHelp.processingState();
                    expect(state.status).to.equal(3);
                    expect(state.i).to.equal(1);
                    expect(state.ii).to.equal(0);

                    await iHelp.dripStage4();
                    state = await iHelp.processingState();

                    expect(state.status).to.equal(3);
                    expect(state.i).to.equal(1);
                    expect(state.ii).to.equal(1);

                    await iHelp.dripStage4();
                    state = await iHelp.processingState();

                    expect(state.status).to.equal(4);
                    expect(state.i).to.equal(0);
                    expect(state.ii).to.equal(0);
                });
            });
        });


        describe("Drip stage 3", async function () {

            beforeEach(async function () {
                charityPool1.getContributors.returns([addr1.address, addr1.address]);
                charityPool2.getContributors.returns([addr1.address, addr1.address]);
                charityPool1.balanceOfUSD.returns(20);
                charityPool2.balanceOfUSD.returns(40);
            });

            it("Should call distribute", async function () {
                const tokensPerIntereset = new BigNumber(10000000000000000000000).mul(1e18).toFixed();
                await iHelp.setVariable('tokensPerInterestByPhase', {
                    1: tokensPerIntereset
                });

                await iHelp.dripStage1();
                await iHelp.dripStage2();
                await expect(iHelp.dripStage3()).to.not.be.reverted;
            });


            describe("Upkeep -- dripStage3", function () {
                it("Should save contract state when running out of gas", async function () {
                    const tokensPerIntereset = new BigNumber(10000000000000000000000).mul(1e18).toFixed();
                    await iHelp.setVariable('tokensPerInterestByPhase', {
                        1: tokensPerIntereset
                    });
                    await iHelp.dripStage1();
                    await iHelp.dripStage2();

                    await iHelp.setProcessingGasLimit(24_000);
                    await iHelp.dripStage3();
                    let state = await iHelp.processingState();

                    expect(state.status).to.equal(2);
                    expect(state.i).to.equal(0);
                    expect(state.ii).to.equal(1);

                    console.log(state.status, state.i, state.ii);
                    await iHelp.dripStage3();
                    state = await iHelp.processingState();
                    expect(state.status).to.equal(2);
                    expect(state.i).to.equal(1);
                    expect(state.ii).to.equal(0);

                    await iHelp.dripStage3();
                    state = await iHelp.processingState();

                    expect(state.status).to.equal(2);
                    expect(state.i).to.equal(1);
                    expect(state.ii).to.equal(1);

                    await iHelp.dripStage3();
                    state = await iHelp.processingState();

                    expect(state.status).to.equal(3);
                    expect(state.i).to.equal(0);
                    expect(state.ii).to.equal(0);
                });
            });
        });


        describe("Perfect interest", async function () {
            it("Should calculate the perfect interest", async function () {
                await iHelp.dripStage1();
                expect(await iHelp.calculatePerfectRedeemInterest()).to.equal(400);
            });
        });

        describe("Dump", async function () {
            beforeEach(async function () {
                charityPool1.getContributors.returns([addr1.address, addr1.address]);
                charityPool2.getContributors.returns([addr1.address, addr1.address]);

                charityPool1.balanceOfUSD.returns(20);
                charityPool2.balanceOfUSD.returns(40);

                cTokenUnderlyingMock.balanceOf.returns(0);

                const holdingPoolAddr = await iHelp.holdingPool();
                await charityPool1.setVariable('charityWallet', holdingPoolAddr);

                charityPool1.redeemInterest.returns(async () => {
                    cTokenUnderlyingMock.balanceOf.reset();

                    await cTokenUnderlyingMock.setVariable('_balances', {
                        [charityPool1.address]: 160,
                        [holdingPoolAddr]: 40
                    });
                });

                charityPool2.redeemInterest.returns(async () => {
                    cTokenUnderlyingMock.balanceOf.reset();
                    await cTokenUnderlyingMock.setVariable('_balances', {
                        [charityPool1.address]: 160,
                        [holdingPoolAddr]: 40
                    });
                });

            });

            // Since mocking the second pool is tedious it's sufficient to do calculations for the frist pool
            it("Should do correct demo calculations for the first pool", async function () {


                await iHelp.dripStage1();
                const pool1InterestShare = await iHelp.charityInterestShare(charityPool1.address);
                await iHelp.dripStage2();
                await iHelp.dripStage4();

                const developmentPool = await iHelp.developmentPool();
                const charityPoolAddress = charityPool1.address;
                const stakingPool = await iHelp.stakingPool();

                const shareOfInterst = {
                    charity: 0.8,
                    development: 0.1,
                    stakingPool: 0.1
                };

                const previouscCaimableCharityInterest = {
                    charity: await iHelp.claimableCharityInterest(charityPoolAddress),
                    development: await iHelp.claimableCharityInterest(developmentPool),
                    stakingPool: await iHelp.claimableCharityInterest(stakingPool)
                };

                const interest = await iHelp.calculatePerfectRedeemInterest();

                await iHelp.connect(operator).dump(interest);
                const { status, totalCharityPoolContributions, newInterestUS } = await iHelp.processingState();

                expect(status).to.equal(0);
                expect(totalCharityPoolContributions).to.equal(0);
                expect(newInterestUS).to.equal(0);

                const differenceInInterest = 200 / pool1InterestShare;
                const correctedInterestShare = pool1InterestShare * differenceInInterest;

                const claimableCharityIntrest = await iHelp.claimableCharityInterest(charityPoolAddress);
                const claimableDevCharityIntrest = await iHelp.claimableCharityInterest(developmentPool);
                const claimableStakeCharityIntrest = await iHelp.claimableCharityInterest(stakingPool);

                expect(claimableCharityIntrest).to.equal(previouscCaimableCharityInterest.charity.add(correctedInterestShare * shareOfInterst.charity));
                expect(claimableDevCharityIntrest).to.equal(previouscCaimableCharityInterest.development.add(correctedInterestShare * shareOfInterst.development));
                expect(claimableStakeCharityIntrest).to.equal(previouscCaimableCharityInterest.stakingPool.add(correctedInterestShare * shareOfInterst.stakingPool));

                expect(await iHelp.charityInterestShare(charityPool1.address)).to.equal(0);
            });
        });

    });

    describe("Interest claiming", function () {
        beforeEach(async function () {
            await iHelp.setVariable('claimableCharityInterest', {
                [addr1.address]: 200
            });
        });

        it("Should not claim interest if it was not called by the holding pool", async function () {

            const mockCharityAddress = addr1.address;
            await iHelp.claimInterest(mockCharityAddress);
            expect(await iHelp.claimableCharityInterest(mockCharityAddress)).to.equal(200);
        });

        it("Should not claim interest if it called by the holding pool but the address is a charity pool", async function () {
            const mockCharityAddress = addr1.address;
            await iHelp.registerCharityPool(addr1.address);
            await iHelp.connect(holdingPool).claimInterest(holdingPool.address);
            expect(await iHelp.claimableCharityInterest(mockCharityAddress)).to.equal(200);
        });

        it("Should claim ad reset the interest", async function () {
            const mockCharityAddress = addr1.address;
            cTokenUnderlyingMock.transferFrom.returns(1);
            await iHelp.connect(holdingPool).claimInterest(mockCharityAddress);
            expect(await iHelp.claimableCharityInterest(mockCharityAddress)).to.equal(0);
        });

        it("Should revert if the transfer fails", async function () {
            const mockCharityAddress = addr1.address;
            cTokenUnderlyingMock.transferFrom.returns(0);
            await expect(iHelp.connect(holdingPool).claimInterest(mockCharityAddress)).to.be.reverted;
        });
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

        it("Should return the getClaimableCharityInterestOf", async function () {
            await iHelp.setVariable("claimableCharityInterest", {
                [owner.address]: 2
            });
            expect(await iHelp.claimableCharityInterest(owner.address)).to.equal(2);
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


});















