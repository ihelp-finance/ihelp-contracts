const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers/lib/utils");
const { smock } = require("@defi-wonderland/smock");
use(smock.matchers);
describe("Charity Pool", function () {
    let charityPool;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let stakingPool, cTokenUnderlyingMock, developmentPool, holdingPool, cTokenMock, iHelpMock;

    beforeEach(async function () {
        const CharityPool = await ethers.getContractFactory("CharityPool");
        
        [owner, addr1, addr2, stakingPool, developmentPool, holdingPool, operator, swapperPool, ...addrs] = await ethers.getSigners();
       
        const Mock = await smock.mock("ERC20MintableMock");
        const CTokenMock = await smock.mock("CTokenMock");
        iHelpMock = await smock.fake("iHelpToken", { address: addr2.address });

        cTokenUnderlyingMock = await Mock.deploy("Mock", "MOK", 18);
        cTokenMock = await CTokenMock.deploy(cTokenUnderlyingMock.address, 1000);
        charityPool = await CharityPool.deploy();

        await charityPool.initialize(
            "TestCharity",
            operator.address,
            holdingPool.address,
            cTokenUnderlyingMock.address,// address _charityWallet,
            "XTC",
            cTokenMock.address,
            cTokenUnderlyingMock.address, //_holdingToken,
            cTokenUnderlyingMock.address,// address _priceFeed,
            iHelpMock.address,
            swapperPool.address,
            stakingPool.address,
            developmentPool.address,
        );
    });

    describe("Deployment", function () {
        it("Should set the right staking pool", async function () {
            expect(await charityPool.stakingPool()).to.equal(stakingPool.address);
        });

        it("Should set the right holding pool", async function () {
            expect(await charityPool.holdingPool()).to.equal(holdingPool.address);
        });

        it("Should set the right development pool", async function () {
            expect(await charityPool.developmentPool()).to.equal(developmentPool.address);
        });

        it("Should set the right token", async function () {
            expect(await charityPool.token()).to.equal(cTokenUnderlyingMock.address);
        });

        it("Should set the right supplyRatePerBlock", async function () {
            expect(await charityPool.supplyRatePerBlock()).to.equal(1000);
        });

        it("Should calculate correct estimatedInterestRate", async function () {
            expect(await charityPool.estimatedInterestRate(10)).to.equal(1000 * 10);
        });

        it("Should get decimals", async function () {
            expect(await charityPool.decimals()).to.equal(18);
        });

        it("Should not set zero address as operator", async function () {
            await expect(charityPool.transferOperator('0x0000000000000000000000000000000000000000')).to.be.revertedWith("Ownable: new operator is the zero address");
        });

        it("Should set new operator", async function () {
            await expect(charityPool.transferOperator(addr1.address)).not.to.be.reverted;
            expect(await charityPool.operator()).to.equal(addr1.address);
        });

        it("Should set new operator", async function () {
            await expect(charityPool.connect(operator).transferOperator(addr1.address)).not.to.be.reverted;
            expect(await charityPool.operator()).to.equal(addr1.address);
        });

        it("Should not allow to set new operator", async function () {
            await expect(charityPool.connect(addr1).transferOperator(addr2.address)).to.be.revertedWith("is-operator-or-owner");
        });

        it("Should set new stakingPool", async function () {
            await expect(charityPool.setStakingPool(addr1.address)).not.to.be.reverted;
            expect(await charityPool.stakingPool()).to.equal(addr1.address);
        });

        it("Should not allow to set new operator", async function () {
            await expect(charityPool.connect(addr1).setStakingPool(addr2.address)).to.be.revertedWith("is-operator-or-owner");
        });

        // it("Should not set zero address as operator", async function () {
        //     await expect(charityPool.setStakingPool('0x0000000000000000000000000000000000000000')).to.be.revertedWith("TODO");
        // });
    });
    

    describe("Deposit", function () {
        beforeEach(async function () {
            await cTokenUnderlyingMock.mint(owner.address, 10000);
            await cTokenUnderlyingMock.increaseAllowance(charityPool.address, 1000);
        });

        it("Should fail to deposit 0", async function () {
            await expect(charityPool.deposit(0)).to.be.revertedWith("Funding/small-amount")
        });

        it("Should emit deposit event", async function () {
            await expect(charityPool.deposit(15))
            .to.emit(charityPool, "Deposited")
        });

        it("Should add address to contributors", async function () {
            await charityPool.deposit(15);
            expect(await charityPool.getContributors()).to.have.members([owner.address]);
        });

        it("Should increase contributor's balance", async function () {
            await charityPool.deposit(15);
            expect(await charityPool.balanceOf(owner.address)).to.equal(15);
        });

        it("Should increase total balance", async function () {
            await charityPool.deposit(15);
            expect(await charityPool.accountedBalance()).to.equal(15);
        });

        it("Should mint to cToken", async function () {
            await charityPool.deposit(15);
            expect(await charityPool.balance()).to.equal(15);
        });
    });

    describe("Sponsor", function () {
        beforeEach(async function () {
            await cTokenUnderlyingMock.mint(owner.address, 10000);
            await cTokenUnderlyingMock.increaseAllowance(charityPool.address, 1000);
        });

        it("Should fail to deposit 0", async function () {
            await expect(charityPool.sponsor(0)).to.be.revertedWith("Funding/small-amount")
        });

        it("Should emit deposit event", async function () {
            await expect(charityPool.deposit(15))
            .to.emit(charityPool, "Deposited")
        });

        it("Should add address to contributors", async function () {
            await charityPool.sponsor(15);
            expect(await charityPool.getContributors()).to.have.members([owner.address]);
        });

        it("Should increase contributor's balance", async function () {
            await charityPool.sponsor(15);
            expect(await charityPool.balanceOf(owner.address)).to.equal(15);
        });

        it("Should increase total balance", async function () {
            await charityPool.sponsor(15);
            expect(await charityPool.accountedBalance()).to.equal(15);
        });

        it("Should mint to cToken", async function () {
            await charityPool.deposit(15);
            expect(await charityPool.balance()).to.equal(15);
        });
    });

    describe("Withdraw", function () {
        beforeEach(async function () {
            await cTokenUnderlyingMock.mint(owner.address, 100);
            await cTokenUnderlyingMock.increaseAllowance(charityPool.address, 100);
            await charityPool.deposit(100);
        });

        it("Should withdraw all balance", async function () {
            await charityPool.withdraw();
            expect(await charityPool.balanceOf(owner.address)).to.equal(0);
        });

        it("Should withdraw partial balance", async function () {
            await charityPool.withdrawAmount(10);
            expect(await charityPool.balanceOf(owner.address)).to.equal(90);
        });

        it("Should fail to withdraw over balance", async function () {
            await expect(charityPool.withdrawAmount(101)).to.be.revertedWith("Funding/no-funds");
            expect(await charityPool.balanceOf(owner.address)).to.equal(100);
        });

        it("Should decrease balance", async function () {
            await charityPool.withdraw();
            expect(await charityPool.balanceOf(owner.address)).to.equal(0);
            expect(await charityPool.balance()).to.equal(0);
        });

        it("Should emit withdrawn event", async function () {
            expect(await charityPool.withdraw())
            .to.emit(charityPool, "Withdrawn")
        });
    });

    describe("Direct Donations", function () {
        beforeEach(async function () {
            await cTokenUnderlyingMock.mint(owner.address, 100);
            await cTokenUnderlyingMock.increaseAllowance(charityPool.address, 100);
        });

        it("Should do nothing when donating 0", async function () {
            expect(await charityPool.directDonation(100))
            .not.to.emit(charityPool, "Rewarded") 
        })

        it("Should emit rewarded event", async function () {
            expect(await charityPool.directDonation(100))
            .to.emit(charityPool, "Rewarded") 
        });
    });
});