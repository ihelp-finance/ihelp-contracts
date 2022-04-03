const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers/lib/utils");
const { smock } = require("@defi-wonderland/smock");
use(smock.matchers);
describe("iHelp", function () {
    let iHelp;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let stakingPool, mockContract, developmentPool, holdingPool;


    beforeEach(async function () {
        const IHelp = await ethers.getContractFactory("iHelpToken");
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

    describe("Drips", function() {
        it("Should increment status", async function() {
            await iHelp.dripStage1();
            expect((await iHelp.processingState()).status).to.equal(1)
        })

        it("Should not allow to skip stages", async function() {
            await iHelp.dripStage1();
            await expect(iHelp.dripStage3()).to.be.revertedWith("Invalid status");
        })

        it("Should go trough stages", async function() {
            await iHelp.dripStage1();
            await iHelp.dripStage2();
            await iHelp.dripStage4();
        })
    })
});