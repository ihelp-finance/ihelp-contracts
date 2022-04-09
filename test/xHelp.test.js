const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers/lib/utils");
const { smock } = require("@defi-wonderland/smock");
use(smock.matchers);
describe("xHelp", function () {
    let Token;
    let tokenContract;
    let ihelp;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let stakingPool, mockContract;


    beforeEach(async function () {
        Token = await ethers.getContractFactory("xHelpToken");
        const IHelp = await ethers.getContractFactory("iHelpToken");
        const Mock = await smock.mock("ERC20MintableMock");

        [owner, addr1, addr2, stakingPool, ...addrs] = await ethers.getSigners();

        tokenContract = await Token.deploy();
        mockContract = await Mock.deploy("Mock", "MOK", 18);
        ihelp = await IHelp.deploy();

        await ihelp.initialize(
            "iHelp",
            "IHLP",
            owner.address,
            stakingPool.address,
            addr1.address,
            addr1.address,
            mockContract.address
        );
        await tokenContract.initialize("TOK", "TOK", ihelp.address);
        await ihelp.increaseAllowance(tokenContract.address, parseEther('999999999999'));
        await mockContract.increaseAllowance(tokenContract.address, parseEther('999999999999'));

    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await tokenContract.owner()).to.equal(owner.address);
        });

        it("Should set the right reward token", async function () {
            expect(await tokenContract.rewardToken()).to.equal(mockContract.address);
        });

        it("Should set the right staking pool", async function () {
            expect(await tokenContract.stakingPool()).to.equal(stakingPool.address);
        });

        it("Should set the right holding pool", async function () {
            expect(await tokenContract.holdingPool()).to.equal(addr1.address);
        });

        it("Shouldn't have any stakeholders", async function () {
            expect(await tokenContract.getStakeholders()).to.be.empty;
        });
    });

    describe("Deposit", function () {
        it("Should fail to deposit 0", async function () {
            await expect(tokenContract.deposit(0)).to.be.revertedWith("Funding/deposit-zero");
        });

        it("Should add sender to stakeholders", async function () {
            await tokenContract.deposit(100);
            expect(await tokenContract.getStakeholders()).to.have.members([owner.address]);
        });

        it("Should deposit amount", async function () {
            await tokenContract.deposit(50);
            expect(await tokenContract.balanceOf(owner.address)).to.equal(50);
        });
    });

    describe("Withdraw", function () {
        it("Should fail to withdraw 0", async function () {
            await expect(tokenContract.withdraw(0)).to.be.revertedWith("Funding/withdraw-zero");
        });

        it("Should fail to withdraw when amount exceeds balance", async function () {
            await tokenContract.deposit(10);
            await expect(tokenContract.withdraw(100)).to.be.reverted;
        });

        it("Should keep sender as stakeholder when not withdrawing full amount", async function () {
            await tokenContract.deposit(100);
            await tokenContract.withdraw(10);
            expect(await tokenContract.getStakeholders()).to.have.members([owner.address]);
        });

        it("Should remove sender from stakeholder when withdrawing full amount", async function () {
            await tokenContract.deposit(100);
            await tokenContract.withdraw(100);
            expect(await tokenContract.getStakeholders()).to.be.empty;
        });

        it("Should decrease balance", async function () {
            await tokenContract.deposit(100);
            await tokenContract.withdraw(10);
            expect(await tokenContract.balanceOf(owner.address)).to.equal(90);
        });
    });

    describe("Transactions", function () {

        it("Should fail transfer when amount exceeds balance", async function () {
            await expect(tokenContract.transfer(addr1.address, 10)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("Should transfer tokens between accounts and update balances", async function () {
            // Transfer 100 tokens from owner to addr1
            const amount = parseEther("50");
            await tokenContract.deposit(amount);
            await tokenContract.transfer(addr1.address, amount);
            expect(await tokenContract.balanceOf(addr1.address)).to.equal(amount);

            // Transfer 10 tokens from addr1 to addr2
            const amount2 = parseEther("10");
            await tokenContract.connect(addr1).transfer(addr2.address, amount2);
            expect(await tokenContract.balanceOf(addr2.address)).to.equal(amount2);
            expect(await tokenContract.balanceOf(addr1.address)).to.equal(amount.sub(amount2));
        });


        it("Should fail if sender doesn't have enough tokens", async function () {
            const amount = 100;
            await tokenContract.deposit(amount);
            await expect(
                tokenContract.transfer(addr1.address, 110)
            ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
            // Balances should be the same
            expect(await tokenContract.balanceOf(owner.address)).to.equal(amount);
            expect(await tokenContract.balanceOf(addr1.address)).to.equal(0);
        });
    });

    describe("Balance", function () {
        it("Should return correct balance ", async function () {
            // Deposit tokens
            await tokenContract.deposit(50);
            expect(await tokenContract.balanceOf(owner.address)).to.equal(50);
        });
    });

    describe("Rewards claiming", function () {
        it("Should return the claimable amount ", async function () {
            // Deposit tokens
            await tokenContract.deposit(50);

            // Mock the reward return
            mockContract.balanceOf.returns(50);
            expect(await tokenContract.claimableReward()).to.equal(50);
        });

        it("Should claim reward", async function () {
            // Deposit tokens
            await tokenContract.deposit(50);

            // Mock the rewards token
            mockContract.balanceOf.returns(50);
            await mockContract.setVariable('_balances', {
                [tokenContract.address]: parseEther('9999999')
            });
            // Execute the claim call
            await tokenContract.claimReward();

            // Check the the transfer function is called
            expect(mockContract.transfer).to.have.been.calledWith(owner.address, 50);
        });

        it("Should claim specific reward", async function () {
            // Deposit tokens
            await tokenContract.deposit(50);

            // Mock the rewards token
            mockContract.balanceOf.returns(50);
            await mockContract.setVariable('_balances', {
                [tokenContract.address]: parseEther('9999999')
            });
            // Execute the claim call
            await tokenContract.claimSpecificReward(25);

            // Check the the transfer function is called
            expect(mockContract.transfer).to.have.been.calledWith(owner.address, 25);
            expect(await tokenContract.claimableReward()).to.equal(25);

        });
    });

    describe("Allowance", function () {
        it("Should increase allowence of addr1 over owner address ", async function () {
            // Increase allowence
            await tokenContract.increaseAllowance(addr1.address, 200);

            // Allowence should be updated
            const allowance = await tokenContract.allowance(owner.address, addr1.address);
            expect(allowance).to.equal(200);
        });

        it("Should decrease allowence after transfer ", async function () {

            await tokenContract.deposit(200);
            // Increase allowence
            await tokenContract.increaseAllowance(addr1.address, 200);
            await tokenContract.connect(addr1).transferFrom(owner.address, addr1.address, 100);

            const allowance = await tokenContract.allowance(owner.address, addr1.address);
            expect(allowance).to.equal(100);
        });

        it("Should revert when allowence is consumed ", async function () {
            // Increase allowence
            await tokenContract.deposit(300);
            await tokenContract.increaseAllowance(addr1.address, 200);
            await tokenContract.connect(addr1).transferFrom(owner.address, addr1.address, 200);

            await expect(
                tokenContract.connect(addr1).transferFrom(owner.address, addr1.address, 200)
            ).to.be.revertedWith('ERC20: insufficient allowance');
        });


        it("Should decrease allowance ", async function () {
            // Increase allowence
            await tokenContract.increaseAllowance(addr1.address, 200);

            // Allowence should be updated
            let allowance = await tokenContract.allowance(owner.address, addr1.address);
            expect(allowance).to.equal(200);


            // Increase allowence
            await tokenContract.decreaseAllowance(addr1.address, 150);

            // Allowence should be updated
            allowance = await tokenContract.allowance(owner.address, addr1.address);
            expect(allowance).to.equal(50);
        });
    });
});