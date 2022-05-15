const { current } = require("@openzeppelin/test-helpers/src/balance");
const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");

describe("TokenVesting", function () {
    let Token;
    let testToken;
    let TokenVesting;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let tokenVesting;
    let baseTime, duration, beneficiary, vestingScheduleId;

    before(async function () {
        Token = await ethers.getContractFactory("ERC20MintableMock");
        TokenVesting = await ethers.getContractFactory("TokenVesting");
    });
    beforeEach(async function () {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        testToken = await Token.deploy("Mock", "MOK", 18);
        await testToken.deployed();
        await testToken.mint(owner.address, parseEther('100000000000'));

        tokenVesting = await TokenVesting.deploy();
        await tokenVesting.initialize(testToken.address);

        const blockBefore = await ethers.provider.getBlock();
        baseTime = blockBefore.timestamp;
        beneficiary = addr1;
        duration = 1000;

        const startTime = baseTime;
        const cliff = 0;
        const slicePeriodSeconds = 1;
        const revokable = true;
        const amount = 100;

        await testToken.transfer(tokenVesting.address, 1000);

        // create new vesting schedule
        await tokenVesting.createVestingSchedule(
            beneficiary.address,
            startTime,
            cliff,
            duration,
            slicePeriodSeconds,
            revokable,
            amount
        );

        vestingScheduleId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
            beneficiary.address,
            0
        );
    });

    describe("Vesting", function () {
        it("Should transfer tokens to the vesting contract", async function () {
            expect((await tokenVesting.getToken()).toString()).to.equal(testToken.address);

            await expect(testToken.transfer(tokenVesting.address, 1000))
                .to.emit(testToken, "Transfer")
                .withArgs(owner.address, tokenVesting.address, 1000);
            const vestingContractBalance = await testToken.balanceOf(
                tokenVesting.address
            );
            expect(vestingContractBalance).to.equal(2000);
        });

        describe('Basic vesting schedule', function () {
            it("Increase vesting schedule count", async function () {
                expect(await tokenVesting.getVestingSchedulesCount()).to.be.equal(1);
                expect(await tokenVesting.getVestingSchedulesCountByBeneficiary(beneficiary.address)).to.be.equal(1);

                // check that vested amount is 0
                expect(
                    await tokenVesting.computeReleasableAmount(vestingScheduleId)
                ).to.be.equal(0);
            });

            it("Shoud compute the correct release amount after 50% of duration pass", async function () {
                await ethers.provider.send("evm_increaseTime", [duration / 2]);
                await ethers.provider.send("evm_mine");
                // check that vested amount is half the total amount to vest
                console.log(await tokenVesting.connect(beneficiary).computeReleasableAmount(vestingScheduleId));
                expect(await tokenVesting.connect(beneficiary).computeReleasableAmount(vestingScheduleId)).to.be.equal(50);
            });

            it("Should not allow vested tokens to be release by non beneficiary", async function () {
                await expect(
                    tokenVesting.connect(addr2).release(vestingScheduleId, 100)
                ).to.be.revertedWith(
                    "TokenVesting: only beneficiary and owner can release vested tokens"
                );
            });

            it("Should not allow beneficiary to release more than the vested amount", async function () {
                await expect(
                    tokenVesting.connect(beneficiary).release(vestingScheduleId, 100)
                ).to.be.revertedWith(
                    "TokenVesting: cannot release tokens, not enough vested tokens"
                );
            });

            it("Should release 10 tokens", async function () {
                await ethers.provider.send("evm_increaseTime", [duration / 2]);
                await ethers.provider.send("evm_mine");

                await expect(tokenVesting.connect(beneficiary).release(vestingScheduleId, 10))
                    .to.emit(testToken, "Transfer")
                    .withArgs(tokenVesting.address, beneficiary.address, 10)
                    .and
                    .to.emit(tokenVesting, "Released").withArgs(beneficiary.address, 10);

                // check that the vested amount is now 40
                expect(await tokenVesting
                    .connect(beneficiary)
                    .computeReleasableAmount(vestingScheduleId)
                ).to.be.equal(40);
                let vestingSchedule = await tokenVesting.getVestingSchedule(
                    vestingScheduleId
                );

                // check that the released amount is 10
                expect(vestingSchedule.released).to.be.equal(10);
            });

            it("Should calculate correct remaning toeksn after realeasing  10 tokens at 50% of the duration", async function () {
                await ethers.provider.send("evm_increaseTime", [duration / 2]);
                await ethers.provider.send("evm_mine");
                await tokenVesting.connect(beneficiary).release(vestingScheduleId, 10);

                await ethers.provider.send("evm_increaseTime", [(duration / 2) + 1]);
                await ethers.provider.send("evm_mine");
                // check that the vested amount is now 50
                expect(
                    await tokenVesting
                        .connect(beneficiary)
                        .computeReleasableAmount(vestingScheduleId)
                ).to.be.equal(90);
            });

            it("Should allow owner to realease tokens to beneficiary", async function () {
                await ethers.provider.send("evm_increaseTime", [duration / 2]);
                await ethers.provider.send("evm_mine");

                await expect(tokenVesting.release(vestingScheduleId, 10))
                    .to.emit(testToken, "Transfer")
                    .withArgs(tokenVesting.address, beneficiary.address, 10);
            });

            it("Should record all released tokens ", async function () {
                await ethers.provider.send("evm_increaseTime", [duration / 2]);
                await ethers.provider.send("evm_mine");

                await tokenVesting.release(vestingScheduleId, 10);
                let vestingSchedule = await tokenVesting.getVestingSchedule(
                    vestingScheduleId
                );
                expect(vestingSchedule.released).to.be.equal(10);

                await tokenVesting.release(vestingScheduleId, 15);

                vestingSchedule = await tokenVesting.getVestingSchedule(
                    vestingScheduleId
                );
                expect(vestingSchedule.released).to.be.equal(25);


                await ethers.provider.send("evm_increaseTime", [(duration / 2) + 1]);
                await ethers.provider.send("evm_mine");

                await tokenVesting.release(vestingScheduleId, 75);
                vestingSchedule = await tokenVesting.getVestingSchedule(
                    vestingScheduleId
                );
                expect(vestingSchedule.released).to.be.equal(100);

                // check that the vested amount is 0
                expect(await tokenVesting.connect(beneficiary).computeReleasableAmount(vestingScheduleId)).to.be.equal(0);
            });
        });

        describe("Vesting schedule withdrawal mechanics", async function () {
            it("Should claculate the value of withdrawable tokens", async function () {
                expect(await tokenVesting.getWithdrawableAmount()).to.equal(900);
            });

            it("Should withdraw available tokens", async function () {
                const withdrawableAmount = await tokenVesting.getWithdrawableAmount();
                await expect(tokenVesting.withdraw(withdrawableAmount)).to.emit(testToken, "Transfer")
                    .withArgs(tokenVesting.address, owner.address, withdrawableAmount);
            });

            it("Should not allow non owner address to withdraw", async function () {
                const withdrawableAmount = await tokenVesting.getWithdrawableAmount();
                await expect(tokenVesting.connect(addr1).withdraw(withdrawableAmount)).to.be.reverted;
            });

            it("Should rever when withdrawing to many tokens", async function () {
                const withdrawableAmount = await tokenVesting.getWithdrawableAmount();
                await expect(tokenVesting.withdraw(withdrawableAmount + 1)).to.be.revertedWith("TokenVesting: not enough withdrawable funds");
            });

        });


        describe("Vesting revoke mechanics", async function () {
            it("Should not give revoke access to non owner address", async function () {
                // check that anyone cannot revoke a vesting
                await expect(tokenVesting.connect(addr2).revoke(vestingScheduleId)).to.be.revertedWith("Ownable: caller is not the owner");
                await tokenVesting.revoke(vestingScheduleId);
            });

            it("Should release vested tokens if revoked", async function () {
                await ethers.provider.send("evm_increaseTime", [duration / 2]);
                await ethers.provider.send("evm_mine");

                await expect(tokenVesting.revoke(vestingScheduleId)).to
                    .emit(testToken, "Transfer")
                    .withArgs(tokenVesting.address, beneficiary.address, 50)
                    .and
                    .to.emit(tokenVesting, "Revoked").withArgs(beneficiary.address, 50);
            });

            it("Should not allow revoke", async function () {
                const blockBefore = await ethers.provider.getBlock();
                const startTime = blockBefore.timestamp;
                await tokenVesting.createVestingSchedule(
                    beneficiary.address,
                    startTime,
                    0,
                    duration,
                    1,
                    false,
                    100
                );

                const nonRevokableScheduleId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
                    beneficiary.address,
                    1
                );
                await expect(tokenVesting.revoke(nonRevokableScheduleId)).to.be.revertedWith("TokenVesting: vesting is not revocable");
            });
        });

        it("Should compute vesting schedule index", async function () {
            const tokenVesting = await TokenVesting.deploy();
            await tokenVesting.initialize(testToken.address);
            const expectedVestingScheduleId =
                "0xa279197a1d7a4b7398aa0248e95b8fcc6cdfb43220ade05d01add9c5468ea097";
            const readlVestingScheduleId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(addr1.address, 0);
            console.log(readlVestingScheduleId);
            expect(readlVestingScheduleId).to.equal(expectedVestingScheduleId);
            expect(await tokenVesting.computeNextVestingScheduleIdForHolder(addr1.address)).to.equal(expectedVestingScheduleId);
        });

        it("Should check input parameters for createVestingSchedule method", async function () {
            const tokenVesting = await TokenVesting.deploy();
            tokenVesting.initialize(testToken.address);
            await testToken.transfer(tokenVesting.address, 1000);
            const time = Date.now();
            await expect(
                tokenVesting.createVestingSchedule(
                    addr1.address,
                    time,
                    0,
                    0,
                    1,
                    false,
                    1
                )
            ).to.be.revertedWith("TokenVesting: duration must be > 0");
            await expect(
                tokenVesting.createVestingSchedule(
                    addr1.address,
                    time,
                    0,
                    1,
                    0,
                    false,
                    1
                )
            ).to.be.revertedWith("TokenVesting: slicePeriodSeconds must be >= 1");
            await expect(
                tokenVesting.createVestingSchedule(
                    addr1.address,
                    time,
                    0,
                    1,
                    1,
                    false,
                    0
                )
            ).to.be.revertedWith("TokenVesting: amount must be > 0");
        });
    });

    describe('Cliff tests', function () {
        let tokenVestingTimeSensitive, time, cliff;
        beforeEach(async () => {
            tokenVestingTimeSensitive = await TokenVesting.deploy();
            await tokenVestingTimeSensitive.initialize(testToken.address);

            await testToken.transfer(tokenVestingTimeSensitive.address, 1000);
            const blockBefore = await ethers.provider.getBlock();
            time = blockBefore.timestamp;
            cliff = 100;
            tokenVestingTimeSensitive.createVestingSchedule(
                addr1.address, //  address,
                time, //            startTime,
                cliff, //            cliff,
                1000, //            duration,
                1, //            slicePeriodSeconds,
                false, //            revokable,
                1000 //            amount
            );

        });

        it("Should not release until cliff has been passed", async function () {
            await ethers.provider.send("evm_increaseTime", [98]);
            await ethers.provider.send("evm_mine");


            const vestingScheduleTsId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
                beneficiary.address,
                0
            );
            expect(
                await tokenVestingTimeSensitive.computeReleasableAmount(vestingScheduleTsId)
            ).to.be.equal(0);
        });

        it("Should release after cliff has been passed", async function () {
            await ethers.provider.send("evm_increaseTime", [101]);
            await ethers.provider.send("evm_mine");
            const blockBefore = await ethers.provider.getBlock();
            const reward = blockBefore.timestamp - time;
            const vestingScheduleTsId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
                beneficiary.address,
                0
            );
            expect(
                await tokenVestingTimeSensitive.computeReleasableAmount(vestingScheduleTsId)
            ).to.be.equal(reward);
        });
    });


    describe('Period slice tests', function () {
        let tokenVestingTimeSensitive, time, cliff, duration;
        beforeEach(async () => {
            tokenVestingTimeSensitive = await TokenVesting.deploy();
            await tokenVestingTimeSensitive.initialize(testToken.address);

            await testToken.transfer(tokenVestingTimeSensitive.address, 1000);
            const blockBefore = await ethers.provider.getBlock();
            time = blockBefore.timestamp;
            cliff = 100;
            duration = 1000;
            tokenVestingTimeSensitive.createVestingSchedule(
                addr1.address, //  address,
                time, //            startTime,
                0, //            cliff,
                duration, //            duration,
                10, //            slicePeriodSeconds,
                false, //            revokable,
                1000 //            amount
            );

        });

        it("Should realse tokens only when a slice has been completed", async function () {
            const blockBefore = await ethers.provider.getBlock();
            const initalTime = blockBefore.timestamp;

            await ethers.provider.send("evm_increaseTime", [1]);

            const vestingScheduleTsId = await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
                beneficiary.address,
                0
            );

            expect(await tokenVestingTimeSensitive.computeReleasableAmount(vestingScheduleTsId)).to.be.equal(0);

            await ethers.provider.send("evm_increaseTime", [10]);
            await ethers.provider.send("evm_mine", []);

            expect(await tokenVestingTimeSensitive.computeReleasableAmount(vestingScheduleTsId)).to.be.equal(10);

            await ethers.provider.send("evm_increaseTime", [5]);
            await ethers.provider.send("evm_mine", []);
            expect(await tokenVestingTimeSensitive.computeReleasableAmount(vestingScheduleTsId)).to.be.equal(10);

            await ethers.provider.send("evm_increaseTime", [10]);
            await ethers.provider.send("evm_mine", []);

            expect(await tokenVestingTimeSensitive.computeReleasableAmount(vestingScheduleTsId)).to.be.equal(20);
        });
    });
});