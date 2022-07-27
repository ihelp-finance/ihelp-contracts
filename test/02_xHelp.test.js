const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers/lib/utils");
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require('ethers');
const { parse } = require('dotenv');
use(smock.matchers);
describe("xHelp", function () {
    let xHelp;
    let tokenContract;
    let ihelp;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let mockContract;


    beforeEach(async function () {
        xHelp = await ethers.getContractFactory("xHelpToken");
        const IHelp = await ethers.getContractFactory("iHelpToken");
        const Mock = await smock.mock("ERC20MintableMock");

        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        tokenContract = await xHelp.deploy();
        mockContract = await Mock.deploy("Mock", "MOK", 18);
        ihelp = await IHelp.deploy();


        await ihelp.initialize(
            "iHelp",
            "IHLP",
            owner.address,
            addr1.address,
            addr1.address,
            mockContract.address,
            addrs[7].address
        );
        await tokenContract.initialize("TOK", "TOK", ihelp.address);
        await ihelp.transfer(addr1.address, parseEther('100'));
        await ihelp.increaseAllowance(tokenContract.address, parseEther('999999999999'));
        await ihelp.connect(addr1).increaseAllowance(tokenContract.address, parseEther('999999999999'));
        await mockContract.increaseAllowance(tokenContract.address, parseEther('999999999999'));
    });

    describe("Deployment", function () {
        it("should set the right owner", async function () {
            expect(await tokenContract.owner()).to.equal(owner.address);
        });

        it("should set the right reward token", async function () {
            expect(await tokenContract.rewardToken()).to.equal(mockContract.address);
        });

        it("shouldn't have any stakeholders", async function () {
            expect(await tokenContract.getStakeholders()).to.be.empty;
        });
    });

    describe("Deposit", function () {
        it("should fail to deposit 0", async function () {
            await expect(tokenContract.deposit(0)).to.be.revertedWith("Funding/deposit-zero");
        });

        it("should add sender to stakeholders", async function () {
            await tokenContract.deposit(100);
            expect(await tokenContract.getStakeholders()).to.have.members([owner.address]);
        });

        it("should deposit amount", async function () {
            await tokenContract.deposit(50);
            expect(await tokenContract.balanceOf(owner.address)).to.equal(50);
        });
    });

    describe("Withdraw", function () {
        it("should fail to withdraw 0", async function () {
            await expect(tokenContract.withdraw(0)).to.be.revertedWith("Funding/withdraw-zero");
        });

        it("should fail to withdraw when amount exceeds balance", async function () {
            await tokenContract.deposit(10);
            await expect(tokenContract.withdraw(100)).to.be.reverted;
        });

        it("should keep sender as stakeholder when not withdrawing full amount", async function () {
            await tokenContract.deposit(100);
            await tokenContract.withdraw(10);
            expect(await tokenContract.getStakeholders()).to.have.members([owner.address]);
        });

        it("should remove sender from stakeholder when withdrawing full amount", async function () {
            await tokenContract.deposit(100);
            await tokenContract.withdraw(100);
            expect(await tokenContract.getStakeholders()).to.be.empty;
        });

        it("should decrease balance", async function () {
            await tokenContract.deposit(100);
            await tokenContract.withdraw(10);
            expect(await tokenContract.balanceOf(owner.address)).to.equal(90);
        });
    });

    describe("Transactions", function () {

        it("should fail transfer when amount exceeds balance", async function () {
            await expect(tokenContract.transfer(addr1.address, 10)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("should transfer tokens between accounts and update balances", async function () {
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


        it("should fail if sender doesn't have enough tokens", async function () {
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
        it("should return correct balance ", async function () {
            // Deposit tokens
            await tokenContract.deposit(50);
            expect(await tokenContract.balanceOf(owner.address)).to.equal(50);
        });

        it("should return correct sender balance ", async function () {
            // Deposit tokens
            await tokenContract.deposit(50);
            expect(await tokenContract.balance()).to.equal(50);
        });
    });

    describe("Staking Logic", function () {
        describe('Distribute', () => {
            it('should distribute to owner', async () => {
                // Generate some rewards
                await mockContract.mint(tokenContract.address, 10);

                await expect(tokenContract.distributeRewards()).to.emit(mockContract, "Transfer").withArgs(tokenContract.address, owner.address, 10);

                expect(await tokenContract.totalToReward()).to.equal(0);
            })

            it('should distribute to xHelp contract', async () => {
                const depositAmount = parseEther('1');
                const rewardAmount = parseEther('10');

                await mockContract.mint(tokenContract.address, rewardAmount);
                await tokenContract.deposit(depositAmount);
                await tokenContract.distributeRewards();

                const result = BigNumber.from(rewardAmount).div(depositAmount);
                expect(await tokenContract.rewardPerTokenStored()).to.equal(1e9 * result.toNumber());
                expect(await tokenContract.totalToReward()).to.equal(0);
                expect(await tokenContract.totalAwarded()).to.equal(parseEther('10'));
            })

            it("should distribute to owner after everybody withdraws", async function () {
                const depositAmount = parseEther('1');
                const rewardAmount = parseEther('10');

                await tokenContract.deposit(depositAmount);
                await tokenContract.withdraw(depositAmount);

                await mockContract.mint(tokenContract.address, rewardAmount);

                await expect(tokenContract.distributeRewards()).to.emit(mockContract, "Transfer").withArgs(tokenContract.address, owner.address, rewardAmount);
            })

        })

        describe('Reward Calculations', () => {
            const depositAmount = parseEther('1');
            const rewardAmount = parseEther('10');

            beforeEach(async () => {
                await mockContract.mint(tokenContract.address, rewardAmount);
                await tokenContract.deposit(depositAmount);
                await tokenContract.connect(addr1).deposit(depositAmount);
                await tokenContract.distributeRewards();
            });

            it("should return the claimable amounts", async function () {
                expect(await tokenContract.claimableReward()).to.equal(parseEther('5'));
                expect(await tokenContract.connect(addr1).claimableReward()).to.equal(parseEther('5'));
            });

            it("should set claimable amount to be be 0 if user enters the pool after drip", async function () {
                await ihelp.transfer(addr2.address, parseEther('100'));
                await ihelp.connect(addr2).increaseAllowance(tokenContract.address, parseEther('999999999999'));
                await tokenContract.deposit(depositAmount);
                expect(await tokenContract.connect(addr2).claimableReward()).to.equal(parseEther('0'));
            });

            it("should calculate correct claimable amounts after second drip", async function () {
                await ihelp.transfer(addr2.address, parseEther('100'));
                await ihelp.connect(addr2).increaseAllowance(tokenContract.address, parseEther('999999999999'));
                await tokenContract.connect(addr2).deposit(depositAmount);

                await mockContract.mint(tokenContract.address, rewardAmount);
                await tokenContract.distributeRewards();
                // expected amounts for user 1 and 2
                const expectedAmount1 = BigNumber.from(rewardAmount).div(2).add(BigNumber.from(rewardAmount).div(3));
                const expectedAmount2 = BigNumber.from(rewardAmount).div(3);

                expect(await tokenContract.claimableReward()).to.be.closeTo(expectedAmount1, parseEther('0.0001'));
                expect(await tokenContract.connect(addr1).claimableReward()).to.be.closeTo(expectedAmount1, parseEther('0.0001'));
                expect(await tokenContract.connect(addr2).claimableReward()).to.be.closeTo(expectedAmount2, parseEther('0.0001'));
            });

            it("should not change climable if user exits and another drip happens", async function () {
                const expectedAmount = BigNumber.from(rewardAmount).div(2);

                await tokenContract.withdraw(depositAmount);
                expect(await tokenContract.userRewardPerTokenPaid(owner.address), "User tokens paid should be correct").to.equal(await tokenContract.rewardPerTokenStored())

                await mockContract.mint(tokenContract.address, rewardAmount);
                await tokenContract.distributeRewards();

                expect(await tokenContract.claimableReward()).to.be.closeTo(expectedAmount, parseEther('0.0001'))
            })

            it("should calculate correct claimable amounts for remaining users after one exits", async function () {
                const expectedAmount = BigNumber.from(rewardAmount).div(2).add(rewardAmount);

                await tokenContract.withdraw(depositAmount);
                expect(await tokenContract.userRewardPerTokenPaid(owner.address), "User tokens paid should be correct").to.equal(await tokenContract.rewardPerTokenStored())

                await mockContract.mint(tokenContract.address, rewardAmount);
                await tokenContract.distributeRewards();

                expect(await tokenContract.connect(addr1).claimableReward()).to.be.closeTo(expectedAmount, parseEther('0.0001'))
            })

            it("should calculate correct claimable after a 50% withdrawal", async function () {
                // expected amount of the withdraw user
                const expectedAmount1 = BigNumber.from(rewardAmount).div(2).add(BigNumber.from(rewardAmount).div(3));

                // expected amount of the remaining user
                const expectedAmount2 = BigNumber.from(rewardAmount).div(2).add(BigNumber.from(rewardAmount).mul(2).div(3));

                await tokenContract.withdraw(depositAmount.div(2));

                await mockContract.mint(tokenContract.address, rewardAmount);
                await tokenContract.distributeRewards();

                expect(await tokenContract.claimableReward()).to.be.closeTo(expectedAmount1, parseEther('0.0001'))
                expect(await tokenContract.connect(addr1).claimableReward()).to.be.closeTo(expectedAmount2, parseEther('0.0001'))
            })

            it("should calculate correct reward after everyone exists", async function () {
                // expected amount of the withdraw user
                const expectedAmount = BigNumber.from(rewardAmount).div(2)

                await tokenContract.withdraw(depositAmount);
                await tokenContract.connect(addr1).withdraw(depositAmount);

                await mockContract.mint(tokenContract.address, rewardAmount);
                await tokenContract.distributeRewards();

                expect(await tokenContract.rewardPerTokenStored()).to.equal(0);
                expect(await tokenContract.claimableReward()).to.be.closeTo(expectedAmount, parseEther('0.0001'))
                expect(await tokenContract.connect(addr1).claimableReward()).to.be.closeTo(expectedAmount, parseEther('0.0001'))
            })
        })

        describe('Reward claims', () => {
            const depositAmount = parseEther('1');
            const rewardAmount = parseEther('10');

            beforeEach(async () => {
                await mockContract.mint(tokenContract.address, rewardAmount);
                await tokenContract.deposit(depositAmount);
                await tokenContract.distributeRewards();
            });

            it("should claim reward", async function () {
                await expect(tokenContract.claimReward()).to.emit(mockContract, "Transfer").withArgs(tokenContract.address, owner.address, rewardAmount);
                expect(await tokenContract.claimableReward()).to.equal(0);
                expect(await tokenContract.totalClaimed()).to.equal(rewardAmount);

            });

            it("should claim specific reward", async function () {
                await expect(tokenContract.claimSpecificReward(rewardAmount.div(2))).to.emit(mockContract, "Transfer").withArgs(tokenContract.address, owner.address, rewardAmount.div(2));
                expect(await tokenContract.claimableReward()).to.equal(rewardAmount.div(2));
                expect(await tokenContract.totalClaimed()).to.equal(rewardAmount.div(2));
            });

            it("should do correct distribution after users claims", async function () {
                await tokenContract.claimReward();
                await mockContract.mint(tokenContract.address, rewardAmount);
                await tokenContract.distributeRewards();
                expect(await tokenContract.claimableReward()).to.equal(rewardAmount);
            });

        })


    });

    describe("Allowance", function () {
        it("should increase allowence of addr1 over owner address ", async function () {
            // Increase allowence
            await tokenContract.increaseAllowance(addr1.address, 200);

            // Allowence should be updated
            const allowance = await tokenContract.allowance(owner.address, addr1.address);
            expect(allowance).to.equal(200);
        });

        it("should decrease allowence after transfer ", async function () {

            await tokenContract.deposit(200);
            // Increase allowence
            await tokenContract.increaseAllowance(addr1.address, 200);
            await tokenContract.connect(addr1).transferFrom(owner.address, addr1.address, 100);

            const allowance = await tokenContract.allowance(owner.address, addr1.address);
            expect(allowance).to.equal(100);
        });

        it("should revert when allowence is consumed ", async function () {
            // Increase allowence
            await tokenContract.deposit(300);
            await tokenContract.increaseAllowance(addr1.address, 200);
            await tokenContract.connect(addr1).transferFrom(owner.address, addr1.address, 200);

            await expect(
                tokenContract.connect(addr1).transferFrom(owner.address, addr1.address, 200)
            ).to.be.revertedWith('ERC20: insufficient allowance');
        });


        it("should decrease allowance ", async function () {
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