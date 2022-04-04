const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers/lib/utils");
const { smock } = require("@defi-wonderland/smock");
const BigNumber = require('big.js');

use(smock.matchers);

describe("iHelp", function () {
    let iHelp;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let stakingPool, mockContract, developmentPool, holdingPool;


    beforeEach(async function () {
        const IHelp = await smock.mock("iHelpToken");
        const Mock = await smock.mock("ERC20MintableMock");

        [owner, addr1, addr2, stakingPool, developmentPool, holdingPool, operator, ...addrs] = await ethers.getSigners();

        mockContract = await Mock.deploy("Mock", "MOK", 18);
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
    });

    describe("Deployment", function () {
        it("Should set the right operator", async function () {
            expect(await iHelp.operator()).to.equal(operator.address);
        });

        it("Should set the right reward token", async function () {
            expect(await iHelp.underlyingToken()).to.equal(mockContract.address);
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
            expect(await iHelp.developmentShareOfInterest()).to.be.equal((0.05 * 1e18).toFixed());
        });

        it("Should set correct stakingShareOfInterest", async function () {
            expect(await iHelp.stakingShareOfInterest()).to.be.equal((0.15 * 1e18).toFixed());
        });

        it("Should set correct charityShareOfInterest", async function () {
            expect(await iHelp.charityShareOfInterest()).to.be.equal((0.80 * 1e18).toFixed());
        });

        it("Should set correct charityShareOfInterest", async function () {
            expect(await iHelp.charityShareOfInterest()).to.be.equal((0.80 * 1e18).toFixed());
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

        it("Should call setTokenPhases", async function () {
            //TODO: Is this checked in the validation script ????
            // expect(iHelp.setTokenPhases).to.be.calledOnce;
        });

        it("Should mint operator balance", async function () {
            expect(await iHelp.balanceOf(operator.address).then(data => Number(data) / 1e18)).to.equal(1000000);
        });

        it("Should mint development pool balance", async function () {
            expect(await iHelp.balanceOf(developmentPool.address).then(data => Number(data) / 1e18)).to.equal(7000000);
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
        });

        it("Should set the __processingGasLimit", async function () {
            await iHelp.connect(operator).setProcessingGasLimit(2);
            expect(await iHelp.__processingGasLimit()).to.equal(2);
        });
    });


    describe("Charity pool management", function () {
        describe("Testing registerCharityPool", function () {
            it("Should revert when not called by owner or operator", async function () {
                await expect(iHelp.connect(addr1).registerCharityPool(addr2.address)).to.be.revertedWith("Funding/is-operator-or-owner");
            });

            it("Should register a new charity pool", async function () {
                await iHelp.registerCharityPool(addr2.address);
                expect(await iHelp.charityPoolInRegistry(addr2.address)).to.not.equal('0x0000000000000000000000000000000000000000');

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
                expect(await iHelp.charityPoolInRegistry(addr2.address)).to.equal('0x0000000000000000000000000000000000000000');

                expect(await iHelp.numberOfCharities()).to.equal(0);
            });
        });


        it("Should calculate the total interest earned by the charity pools", async function () {
            const CharityPool = await smock.mock('CharityPool');
            const charityPool1 = await CharityPool.deploy();
            const charityPool2 = await CharityPool.deploy();

            charityPool1.totalInterestEarned.returns(20);
            charityPool2.totalInterestEarned.returns(40);

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

            charityPool1.calculateTotalIncrementalInterest.returns();
            charityPool2.calculateTotalIncrementalInterest.returns();

            charityPool1.newTotalInterestEarnedUSD.returns(200);
            charityPool2.newTotalInterestEarnedUSD.returns(200);

            charityPool2.accountedBalanceUSD.returns(200);
            charityPool1.accountedBalanceUSD.returns(200);

            // await charityPool1.setVariable('ihelpToken', iHelp.address);
            // await charityPool2.setVariable('ihelpToken', iHelp.address);

            await iHelp.registerCharityPool(charityPool1.address);
            await iHelp.registerCharityPool(charityPool2.address);
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

                // TODO: Is this calculation valid ?? Ask Matt
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
                await iHelp.setVariable('__tokensPerInterestByPhase', {
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

                // TODO: Add buisiness logic checks here
            });
        });


        describe("Drip stage 4", async function () {

            beforeEach(async function () {
                charityPool1.getContributors.returns([addr1.address, addr1.address]);
                charityPool2.getContributors.returns([addr1.address, addr1.address]);
                charityPool1.balanceOfUSD.returns(20);
                charityPool2.balanceOfUSD.returns(40);
            });

            it("Should call distribute", async function () {
                await iHelp.dripStage1();
                await iHelp.dripStage2();
                await expect(iHelp.dripStage4()).to.not.be.reverted;
                expect(iHelp.distribute).to.have.been.calledOnce;

            });

            //TODO: will the validations script cover testing for this buisiness logic
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
                await iHelp.setVariable('__tokensPerInterestByPhase', {
                    1: tokensPerIntereset
                });

                await iHelp.dripStage1();
                await iHelp.dripStage2();
                await expect(iHelp.dripStage3()).to.not.be.reverted;
                expect(iHelp.distribute).to.have.been.calledOnce;
            });

            //TODO: will the validations script cover testing for this buisiness logic
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

                mockContract.balanceOf.returns(0);
                charityPool1.redeemInterest.returns(() => {
                    mockContract.balanceOf.returns(200);
                });
                charityPool2.redeemInterest.returns(() => {
                    mockContract.balanceOf.returns(200);
                });

            });

            it("Call dump related functions", async function () {
                await iHelp.dripStage1();
                await iHelp.dripStage2();
                await iHelp.dripStage4();

                const interest = await iHelp.calculatePerfectRedeemInterest();
                await iHelp.connect(operator).dump(interest);
                const { status, totalCharityPoolContributions, newInterestUS } = await iHelp.processingState();

                // TODO: Is he state correct after the drip 
                expect(status).to.equal(0);
                expect(totalCharityPoolContributions).to.equal(0);
                expect(newInterestUS).to.equal(0);

                expect(charityPool1.redeemInterest).to.have.been.calledOnce;
                expect(charityPool2.redeemInterest).to.have.been.calledOnce;

            });
        });

    });
});