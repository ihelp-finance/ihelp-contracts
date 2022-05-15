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
    before(async function () {
        Token = await ethers.getContractFactory("ERC20MintableMock");
        TokenVesting = await ethers.getContractFactory("TokenVesting");
    });
    beforeEach(async function () {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        testToken = await Token.deploy("Mock", "MOK", 18);
        await testToken.deployed();
        await testToken.mint(owner.address, parseEther('100000000000'));

        tokenVesting = await TokenVesting.deploy(testToken.address);
    });

    describe("Vesting", function () {

        it("Should assign the total supply of tokens to the owner", async function () {
            const ownerBalance = await testToken.balanceOf(owner.address);
            expect(await testToken.totalSupply()).to.equal(ownerBalance);
        });


        it("Should transfer tokens to the vesting contract", async function () {
            expect((await tokenVesting.getToken()).toString()).to.equal(
                testToken.address
            );

            await expect(testToken.transfer(tokenVesting.address, 1000))
                .to.emit(testToken, "Transfer")
                .withArgs(owner.address, tokenVesting.address, 1000);
            const vestingContractBalance = await testToken.balanceOf(
                tokenVesting.address
            );
            expect(vestingContractBalance).to.equal(1000);
            expect(await tokenVesting.getWithdrawableAmount()).to.equal(1000);
        });

        describe('Basic vesting schedule', function () {
            let baseTime, duration, beneficiary, vestingScheduleId;
            beforeEach(async function () {
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

            it("Increase vesting schedule count", async function () {
                expect(await tokenVesting.getVestingSchedulesCount()).to.be.equal(1);
                expect(await tokenVesting.getVestingSchedulesCountByBeneficiary(beneficiary.address)).to.be.equal(1);

                // check that vested amount is 0
                expect(
                    await tokenVesting.computeReleasableAmount(vestingScheduleId)
                ).to.be.equal(0);
            });

            it("Shoud compute the corrent release amount after 50% of duration pass", async function () {
                await ethers.provider.send("evm_increaseTime", [duration / 2]);
                await ethers.provider.send("evm_mine");
                // check that vested amount is half the total amount to vest
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
                    .withArgs(tokenVesting.address, beneficiary.address, 10);

                // check that the vested amount is now 40
                expect(
                    await tokenVesting
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
            });
        });


        // it("Should vest tokens gradually", async function () {

        //     // check that the number of released tokens is 100
        //     expect(vestingSchedule.released).to.be.equal(100);

        //     // check that the vested amount is 0
        //     expect(
        //         await tokenVesting
        //             .connect(beneficiary)
        //             .computeReleasableAmount(vestingScheduleId)
        //     ).to.be.equal(0);

        //     // check that anyone cannot revoke a vesting
        //     await expect(
        //         tokenVesting.connect(addr2).revoke(vestingScheduleId)
        //     ).to.be.revertedWith(" Ownable: caller is not the owner");
        //     await tokenVesting.revoke(vestingScheduleId);

        //     /*
        //      * TEST SUMMARY
        //      * deploy vesting contract
        //      * send tokens to vesting contract
        //      * create new vesting schedule (100 tokens)
        //      * check that vested amount is 0
        //      * set time to half the vesting period
        //      * check that vested amount is half the total amount to vest (50 tokens)
        //      * check that only beneficiary can try to release vested tokens
        //      * check that beneficiary cannot release more than the vested amount
        //      * release 10 tokens and check that a Transfer event is emitted with a value of 10
        //      * check that the released amount is 10
        //      * check that the vested amount is now 40
        //      * set current time after the end of the vesting period
        //      * check that the vested amount is 90 (100 - 10 released tokens)
        //      * release all vested tokens (90)
        //      * check that the number of released tokens is 100
        //      * check that the vested amount is 0
        //      * check that anyone cannot revoke a vesting
        //      */
        // });

        // it("Should release vested tokens if revoked", async function () {
        //     // deploy vesting contract
        //     const tokenVesting = await TokenVesting.deploy(testToken.address);
        //     await tokenVesting.deployed();
        //     expect((await tokenVesting.getToken()).toString()).to.equal(
        //         testToken.address
        //     );
        //     // send tokens to vesting contract
        //     await expect(testToken.transfer(tokenVesting.address, 1000))
        //         .to.emit(testToken, "Transfer")
        //         .withArgs(owner.address, tokenVesting.address, 1000);

        //     const baseTime = 1622551248;
        //     const beneficiary = addr1;
        //     const startTime = baseTime;
        //     const cliff = 0;
        //     const duration = 1000;
        //     const slicePeriodSeconds = 1;
        //     const revokable = true;
        //     const amount = 100;

        //     // create new vesting schedule
        //     await tokenVesting.createVestingSchedule(
        //         beneficiary.address,
        //         startTime,
        //         cliff,
        //         duration,
        //         slicePeriodSeconds,
        //         revokable,
        //         amount
        //     );

        //     // compute vesting schedule id
        //     const vestingScheduleId =
        //         await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
        //             beneficiary.address,
        //             0
        //         );

        //     // set time to half the vesting period
        //     const halfTime = baseTime + duration / 2;
        //     // await tokenVesting.setCurrentTime(halfTime);

        //     await expect(tokenVesting.revoke(vestingScheduleId))
        //         .to.emit(testToken, "Transfer")
        //         .withArgs(tokenVesting.address, beneficiary.address, 50);
        // });

        it("Should compute vesting schedule index", async function () {
            const tokenVesting = await TokenVesting.deploy(testToken.address);
            await tokenVesting.deployed();
            const expectedVestingScheduleId =
                "0xa279197a1d7a4b7398aa0248e95b8fcc6cdfb43220ade05d01add9c5468ea097";
            expect(
                (
                    await tokenVesting.computeVestingScheduleIdForAddressAndIndex(
                        addr1.address,
                        0
                    )
                ).toString()
            ).to.equal(expectedVestingScheduleId);
            expect(
                (
                    await tokenVesting.computeNextVestingScheduleIdForHolder(
                        addr1.address
                    )
                ).toString()
            ).to.equal(expectedVestingScheduleId);
        });

        it("Should check input parameters for createVestingSchedule method", async function () {
            const tokenVesting = await TokenVesting.deploy(testToken.address);
            await tokenVesting.deployed();
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
});