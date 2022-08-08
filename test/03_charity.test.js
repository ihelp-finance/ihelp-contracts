const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { smock } = require("@defi-wonderland/smock");
const { getDirectDonactionsBySenders } = require("../scripts/eventQuery")
const { abi } = require("../artifacts/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json");
const { constants } = require('@openzeppelin/test-helpers');
use(smock.matchers);

describe("Charity Pool", function () {
    let charityPool;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let stakingPool, cTokenUnderlyingMock, developmentPool, cTokenMock, iHelpMock, holdingMock;
    let wTokenMock;
    let CTokenMock, Mock;
    let swapperMock;
    let priceFeedProviderMock, aggregator;
    let CompoundConnector;


    beforeEach(async function () {
        const CharityPool = await smock.mock("CharityPool");

        [owner, addr1, addr2, stakingPool, developmentPool, holdingPool, operator, swapperPool, charityWallet, ...addrs] = await ethers.getSigners();

        Mock = await smock.mock("ERC20MintableMock");
        const WMock = await ethers.getContractFactory("WTokenMock");
        CTokenMock = await smock.mock("CTokenMock");

        const ProtocolConnector = await smock.mock("CompoundConnector");
        CompoundConnector = await ProtocolConnector.deploy();
        await CompoundConnector.initialize();

        aggregator = await smock.fake(abi);
        aggregator.latestRoundData.returns([0, 1e9, 0, 0, 0]);

        iHelpMock = await smock.fake("iHelpToken", { address: addr2.address });

        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
        priceFeedProviderMock = await PriceFeedProvider.deploy();

        cTokenUnderlyingMock = await Mock.deploy("Mock", "MOK", 18);

        holdingMock = await Mock.deploy("Mock", "MOK", 9);
        cTokenMock = await CTokenMock.deploy(cTokenUnderlyingMock.address, 1000);
        wTokenMock = await WMock.deploy();

        charityPool = await CharityPool.deploy();
        swapperMock = await smock.fake("Swapper", { address: swapperPool.address });
        await charityPool.initialize({
            charityName: "TestCharity",
            operatorAddress: operator.address,
            charityWalletAddress: charityWallet.address,// address _charityWallet,
            holdingTokenAddress: holdingMock.address, //_holdingToken,
            ihelpAddress: iHelpMock.address,
            swapperAddress: swapperMock.address,
            wrappedNativeAddress: wTokenMock.address,
            priceFeedProvider: priceFeedProviderMock.address
        });

        await priceFeedProviderMock.initialize([{
            provider: "TestProvider",
            lendingAddress: cTokenMock.address,
            currency: "CTokenMock",
            underlyingToken: cTokenUnderlyingMock.address,
            priceFeed: aggregator.address,
            connector: CompoundConnector.address
        }]);

        iHelpMock.stakingPool.returns(stakingPool.address);
        iHelpMock.developmentPool.returns(developmentPool.address);
        iHelpMock.getPools.returns([developmentPool.address, stakingPool.address]);
        swapperMock.nativeToken.returns(wTokenMock.address);
        swapperMock.getAmountsOutByPath.returns(arg => arg[1] * 1e9);
    });

    describe("Deployment", function () {
        it("Should set the right staking pool", async function () {
            expect(await charityPool.stakingPool()).to.equal(stakingPool.address);
        });

        it("Should set the right price feed provider", async function () {
            expect(await charityPool.priceFeedProvider()).to.equal(priceFeedProviderMock.address);
        });

        it("Should set the right development pool", async function () {
            expect(await charityPool.developmentPool()).to.equal(developmentPool.address);
        });

        it("Should set the right supplyRatePerBlock", async function () {
            expect(await charityPool.supplyRatePerBlock(cTokenMock.address)).to.equal(1000);
        });

        it("Should calculate correct estimatedInterestRate", async function () {
            expect(await charityPool.estimatedInterestRate(10, cTokenMock.address)).to.equal(1000 * 10);
        });

        it("Should get decimals", async function () {
            expect(await charityPool.decimals(cTokenMock.address)).to.equal(18);
        });

        it("Should set new operator", async function () {
            await expect(charityPool.transferOperator(addr1.address)).not.to.be.reverted;
            expect(await charityPool.operator()).to.equal(addr1.address);
        });

        it("Should set new operator as operator", async function () {
            await expect(charityPool.connect(operator).transferOperator(addr1.address)).not.to.be.reverted;
            expect(await charityPool.operator()).to.equal(addr1.address);
        });

        it("Should not allow to set new operator", async function () {
            await expect(charityPool.connect(addr1).transferOperator(addr2.address)).to.be.revertedWith("is-operator-or-owner");
        });

        it("Should update the charity wallet", async function () {
            await expect(charityPool.setCharityWallet(addr1.address)).not.to.be.reverted;
            expect(await charityPool.charityWallet()).to.equal(addr1.address);
        });

        it("Should return the balance of cToken", async function () {
            cTokenMock.balanceOfUnderlying.returns(10000);
            expect(await charityPool.balance(cTokenMock.address)).to.equal(10000);
        });
    });


    describe("Deposit", function () {
        beforeEach(async function () {
            await cTokenUnderlyingMock.mint(owner.address, 10000);
            await cTokenUnderlyingMock.increaseAllowance(charityPool.address, 1000);
        });

        it("Should fail to deposit 0", async function () {
            await expect(charityPool.depositTokens(cTokenMock.address, 0)).to.be.revertedWith("Funding/small-amount");
        });

        it("Should emit deposit event", async function () {
            await expect(charityPool.depositTokens(cTokenMock.address, 15))
                .to.emit(charityPool, "Deposited").withArgs(owner.address, cTokenMock.address, 15);
        });

        it("Should add address to contributors", async function () {
            await charityPool.depositTokens(cTokenMock.address, 15);
            expect(await charityPool.getContributors()).to.have.members([owner.address]);
            expect(await charityPool.numberOfContributors()).to.equal(1);
        });

        it("Should increase contributor's balance", async function () {
            await charityPool.depositTokens(cTokenMock.address, 15);
            expect(await charityPool.balanceOf(owner.address, cTokenMock.address)).to.equal(15);
        });

        it("Should increase total balance", async function () {
            await charityPool.depositTokens(cTokenMock.address, 15);
            expect(await charityPool.accountedBalances(cTokenMock.address)).to.equal(15);
        });

        it("Should mint to cToken", async function () {
            await charityPool.depositTokens(cTokenMock.address, 15);
            expect(await charityPool.balance(cTokenMock.address)).to.equal(15);
        });

        it("Should calculate usd balance", async function () {
            const deposit = 100;
            const expectedBalanceInUsd = parseUnits('' + deposit, 9);

            await charityPool.depositTokens(cTokenMock.address, deposit);
            expect(await charityPool.balanceOfUSD(owner.address)).to.equal(expectedBalanceInUsd);
        });

        describe("Native Deposits", function () {
            let deposit = 100
            beforeEach(async function () {
                await cTokenMock.setVariable("underlying", wTokenMock.address)
            });

            it("Should allow native deposits", async function () {
                const expectedBalanceInUsd = parseUnits('' + deposit, 9);
                await charityPool.depositNative(cTokenMock.address, { value: deposit });
                expect(await charityPool.balanceOfUSD(owner.address)).to.equal(expectedBalanceInUsd);
            })

            it("Should emit Deposited Event on native deposit", async function () {
                await expect(charityPool.depositNative(cTokenMock.address, { value: deposit })).to
                    .emit(charityPool, "Deposited")
                    .withArgs(owner.address, cTokenMock.address, deposit);
            })

            it("Should change the user balance on deposit", async function () {
                await expect(await charityPool.depositNative(cTokenMock.address, { value: deposit })).to
                    .changeEtherBalances([owner, wTokenMock], [-100, 100])
            })
        });
    });

    describe("Withdraw", function () {
        beforeEach(async function () {
            await cTokenMock.setVariable("underlying", wTokenMock.address);
            await charityPool.depositNative(cTokenMock.address, { value: 100 });
        });

        it("Should withdraw all balance", async function () {
            await charityPool.withdrawTokens(cTokenMock.address, 0);
            expect(await charityPool.balanceOf(owner.address, cTokenMock.address)).to.equal(0);
        });

        it("Should withdraw partial balance", async function () {
            await charityPool.withdrawTokens(cTokenMock.address, 10);
            expect(await charityPool.balanceOf(owner.address, cTokenMock.address)).to.equal(90);
        });

        it("Should fail to withdraw over balance", async function () {
            await expect(charityPool.withdrawTokens(cTokenMock.address, 101)).to.be.revertedWith("Funding/no-funds");
            expect(await charityPool.balanceOf(owner.address, cTokenMock.address,)).to.equal(100);
        });

        it("Should decrease balance", async function () {
            await charityPool.withdrawTokens(cTokenMock.address, 0);
            expect(await charityPool.balanceOf(owner.address, cTokenMock.address)).to.equal(0);
            expect(await charityPool.balance(cTokenMock.address)).to.equal(0);
            expect(await charityPool.numberOfContributors()).to.equal(0);
        });

        it("Should emit withdrawn event", async function () {
            expect(await charityPool.withdrawTokens(cTokenMock.address, 0))
                .to.emit(charityPool, "Withdrawn");
        });

        describe("Native Withdrawals", function () {
            let amount = 100;

            it("Should allow native withdrawals", async function () {
                await charityPool.withdrawNative(cTokenMock.address, amount);
                expect(await charityPool.balanceOfUSD(owner.address)).to.equal(0);
                expect(await charityPool.balance(cTokenMock.address)).to.equal(0);
            })

            it("Should emit Withdrawn Event on native deposit", async function () {
                await expect(charityPool.withdrawNative(cTokenMock.address, amount))
                    .emit(charityPool, "Withdrawn")
                    .withArgs(owner.address, cTokenMock.address, amount);
            })

            it("Should change the user balance on deposit", async function () {
                await expect(await charityPool.withdrawNative(cTokenMock.address, amount)).to
                    .changeEtherBalances([owner, wTokenMock], [100, -100])
            })
        });

        describe("Bulk withdrawals", function () {
            let amount = 100;
            let cTokenMock2, uTokenMock2;
            beforeEach(async () => {
                uTokenMock2 = await Mock.deploy("uMock", "uMOK", 18);
                cTokenMock2 = await CTokenMock.deploy(uTokenMock2.address, 1000);

                await priceFeedProviderMock.addDonationCurrencies([{
                    provider: "TestProvider2",
                    lendingAddress: cTokenMock2.address,
                    currency: "CTokenMock",
                    underlyingToken: uTokenMock2.address,
                    priceFeed: aggregator.address
                }]);

                await uTokenMock2.mint(owner.address, 10000);
                await uTokenMock2.increaseAllowance(charityPool.address, 1000);

                await charityPool.depositTokens(cTokenMock2.address, amount);
            })

            it("Should not allow withdrawal if sender is not the target account", async function () {
                expect(charityPool.withdrawAll(addr1.address)).to.be.revertedWith("funding/not-allowed");
            })

            it("Should perform bulk withdrawals", async function () {
                await expect(charityPool.withdrawAll(owner.address)).to
                    .emit(uTokenMock2, "Transfer")
                    .withArgs(charityPool.address, owner.address, amount)
                    .emit(wTokenMock, "Transfer")
                    .withArgs(charityPool.address, owner.address, amount)
            })

            it("Should perform bulk withdrawals fromIHelp", async function () {
                await expect(charityPool.connect(iHelpMock.wallet).withdrawAll(owner.address)).to
                    .emit(uTokenMock2, "Transfer")
                    .withArgs(charityPool.address, owner.address, amount)
                    .emit(wTokenMock, "Transfer")
                    .withArgs(charityPool.address, owner.address, amount)
            })
        });
    });

    describe("Direct Donations", function () {
        const stakeFee = 100;
        const devFee = 100;
        const charityFee = 800;
        beforeEach(async function () {
            await cTokenUnderlyingMock.mint(owner.address, parseEther("100"));
            await cTokenUnderlyingMock.increaseAllowance(charityPool.address, parseEther("100"));
            await holdingMock.increaseAllowance(charityPool.address, parseEther("100"));
            await holdingMock.mint(owner.address, parseEther("100"));

            // Mock swap values 
            swapperMock.swap.returns(args => {
                return args[2];
            });
            iHelpMock.developmentShareOfInterest.returns(devFee);
            iHelpMock.charityShareOfInterest.returns(charityFee);
            iHelpMock.stakingShareOfInterest.returns(stakeFee);
            iHelpMock.getFees.returns([devFee, stakeFee, charityFee]);

            await priceFeedProviderMock.addDonationCurrencies([{
                provider: "TestProvide2r",
                lendingAddress: holdingMock.address,
                currency: "HoldingToken",
                underlyingToken: holdingMock.address,
                priceFeed: aggregator.address,
                connector: CompoundConnector.address
            }]);
            
        });

        it("Should do nothing when donating 0", async function () {
            expect(await charityPool.directDonation(cTokenUnderlyingMock.address, 0))
                .not.to.emit(charityPool, "DirectDonation");
        });

        it("Should emit Direct Donation event", async function () {
            expect(await charityPool.directDonation(holdingMock.address, 100))
                .to.emit(charityPool, "DirectDonation").withArgs(owner.address, charityWallet.address, 100);
        });

        it("Should add address to contributors", async function () {
            expect(await charityPool.directDonation(holdingMock.address, 100));
            expect(await charityPool.getContributors()).to.have.members([owner.address]);
            expect(await charityPool.numberOfContributors()).to.equal(1);
        });

        it("Should update the direct doantions balance", async function () {
            await charityPool.directDonation(holdingMock.address, 100);
            expect(await charityPool.donationBalances(owner.address, holdingMock.address)).to.equal(100);
        });

        it("Should send staking fee", async function () {
            await charityPool.setVariable('holdingToken', cTokenUnderlyingMock.address);
            const amount = parseEther("10");
            const fee = await iHelpMock.stakingShareOfInterest();
            const expectedAmountAfterTax = amount.mul(fee).div(1000);

            await charityPool.directDonation(cTokenUnderlyingMock.address, amount);
            expect(await cTokenUnderlyingMock.balanceOf(stakingPool.address)).to.equal(expectedAmountAfterTax);
        });

        it("Should swap and send staking fee", async function () {
            const amount = parseEther("10");
            // Mint the holding tokens to the charity in order to simulate the swaps
            await holdingMock.mint(charityPool.address, amount);
            await charityPool.directDonation(cTokenUnderlyingMock.address, amount);
            expect(swapperMock.swap).to.be.calledOnce;
        });

        it("Should send development fee", async function () {
            const amount = parseEther("10");
            const fee = await iHelpMock.developmentShareOfInterest();
            const expectedAmountAfterTax = amount.mul(fee).div(1000);

            // Mint the holding tokens to the charity in order to simulate the swaps
            await holdingMock.mint(charityPool.address, amount);

            await expect(charityPool.directDonation(cTokenUnderlyingMock.address, amount))
                .to.emit(holdingMock, "Transfer")
                .withArgs(charityPool.address, developmentPool.address, expectedAmountAfterTax);
        });

        it("Should send donation to the charity wallet", async function () {
            const amount = parseEther("10");
            const fee = await iHelpMock.charityShareOfInterest();
            const expectedAmountAfterTax = amount.mul(fee).div(1000);
            // Mint the holding tokens to the charity in order to simulate the swaps
            await holdingMock.mint(owner.address, amount);

            console.log("Expected share", expectedAmountAfterTax);

            await expect(charityPool.directDonation(holdingMock.address, amount))
                .to.emit(holdingMock, "Transfer")
                .withArgs(charityPool.address, charityWallet.address, expectedAmountAfterTax);
        });


        it("Should keep the donation in the charity contract", async function () {
            await charityPool.setVariable("charityWallet", constants.ZERO_ADDRESS);
            const amount = parseEther("10");
            const fee = await iHelpMock.charityShareOfInterest();
            const expectedAmountAfterTax = amount.mul(fee).div(1000);
            // Mint the holding tokens to the charity in order to simulate the swaps
            await holdingMock.mint(owner.address, amount);

            await expect(charityPool.directDonation(holdingMock.address, amount))
                .to.emit(holdingMock, "Transfer")
                .withArgs(owner.address, charityPool.address, amount);

            expect(await holdingMock.balanceOf(charityPool.address)).to.equal(expectedAmountAfterTax);

        });

        it("Should update the direct donations registry", async function () {
            const amount = parseEther("10");
            // Simulated conversion parity 1/2..
            const convertedAmount = amount.div(2);
            swapperMock.getNativeRoutedTokenPrice.returns(() => convertedAmount)

            const charityAmount = convertedAmount.mul(charityFee).div(1000);
            const devAmount = convertedAmount.mul(devFee).div(1000);
            const stakeAmount = convertedAmount.mul(stakeFee).div(1000);

            // Mock swap values 
            swapperMock.swap.returns(args => convertedAmount);

            await holdingMock.mint(charityPool.address, convertedAmount);
            await charityPool.directDonation(cTokenUnderlyingMock.address, amount);

            const donationRegistry = await charityPool.donationsRegistry(owner.address);

            // TODO: How do we keep track of all the tokens types?
            expect(donationRegistry.totalContribNativeToken).to.equal(0);
            expect(donationRegistry.totalContribUSD).to.equal(convertedAmount);
            expect(donationRegistry.contribAfterSwapUSD).to.equal(convertedAmount);
            expect(donationRegistry.charityDonationUSD).to.equal(charityAmount);
            expect(donationRegistry.devContribUSD).to.equal(devAmount);
            expect(donationRegistry.stakeContribUSD).to.equal(stakeAmount);
        });

        it("Should accept native tokens as direct donations", async function () {
            const amount = parseEther("10");

            // Mint the holding tokens to the charity in order to simulate the swaps
            await holdingMock.mint(charityPool.address, amount);
            await expect(charityPool.directDonationNative({
                value: amount,
                gasPrice: parseUnits('4', 'gwei'),
                gasLimit: '500000',
            })).to.emit(charityPool, "DirectDonation").withArgs(owner.address, charityWallet.address, amount);
        })

        // TODO:@Matt quick example on how to use event logs run
        //  hh test --network hardhat test/03_charity.test.js --grep "Should query direct donation events"
        it("Should query direct donation events", async function () {
            await charityPool.directDonation(holdingMock.address, 100);
            const donations = await getDirectDonactionsBySenders(charityPool.address, ethers.provider, [owner.address]);
            console.log(donations);
        });
    });

    describe("Interest", function () {
        beforeEach(async function () {
            await cTokenUnderlyingMock.setVariable('_decimals', 9);
            await cTokenUnderlyingMock.mint(owner.address, parseEther("200000"));
            await cTokenUnderlyingMock.increaseAllowance(charityPool.address, parseEther("200000"));
        });

        it("Should return interest of cToken", async function () {
            cTokenMock.balanceOfUnderlying.returns(10000);
            expect(await charityPool.interestEarned(cTokenMock.address)).to.equal(10000);
        });

        it("Should return interest", async function () {
            const interest = 10000;
            const deposit = parseEther("200");
            const withdrawal = parseEther("150");
            await charityPool.depositTokens(cTokenMock.address, deposit);
            await charityPool.withdrawTokens(cTokenMock.address, withdrawal);
            cTokenMock.balanceOfUnderlying.returns(deposit.sub(withdrawal).add(interest));
            expect(await charityPool.accountedBalances(cTokenMock.address)).to.equal(deposit.sub(withdrawal));
            expect(await charityPool.interestEarned(cTokenMock.address)).to.equal(interest);
        });

        it("Should return the claimable interest of the charity", async function () {
            await holdingMock.setVariable("_balances", {
                [charityPool.address]: 200
            });
            expect(await charityPool.claimableInterest()).to.equal(200);
        });

        it("Should claim interest", async function () {
            await holdingMock.setVariable("_balances", {
                [charityPool.address]: 200
            });
            const charityWallet = await charityPool.charityWallet();
            expect(charityPool.claimInterest())
                .to
                .emit(holdingMock, "Transfer")
                .withArgs(charityPool.address, charityWallet, 200)
        });

        it("Should return 0 when there's no interest", async function () {
            cTokenMock.balanceOfUnderlying.returns(0);
            const deposit = 200;
            const withdrawal = 50;
            await charityPool.depositTokens(cTokenMock.address, deposit);
            await charityPool.withdrawTokens(cTokenMock.address, withdrawal);
            expect(await charityPool.interestEarned(cTokenMock.address)).to.equal(0);
        });

        it("Should calculate redeemable interest", async function () {
            const interest = 10000;
            cTokenMock.balanceOfUnderlying.returns(interest);

            await charityPool.connect(iHelpMock.wallet).calculateTotalIncrementalInterest(cTokenMock.address);
            expect(await charityPool.redeemableInterest(cTokenMock.address)).to.equal(interest);
        });

        it("Should not add new redeemable interest", async function () {
            const interest = 10000;
            cTokenMock.balanceOfUnderlying.returns(interest);

            await charityPool.connect(iHelpMock.wallet).calculateTotalIncrementalInterest(cTokenMock.address);
            expect(await charityPool.redeemableInterest(cTokenMock.address)).to.equal(interest);
            await charityPool.connect(iHelpMock.wallet).calculateTotalIncrementalInterest(cTokenMock.address);
            expect(await charityPool.redeemableInterest(cTokenMock.address)).to.equal(interest);
        });

        it("Should calculate usd interest", async function () {
            const interest = 10000;
            const expectedInterestInUsd = interest;
            cTokenMock.balanceOfUnderlying.returns(interest);

            await charityPool.connect(iHelpMock.wallet).calculateTotalIncrementalInterest(cTokenMock.address);
            expect(await charityPool.newTotalInterestEarnedUSD()).to.equal(expectedInterestInUsd);
            expect(await charityPool.totalInterestEarnedUSD()).to.equal(expectedInterestInUsd);
            expect(await charityPool.accountedBalanceUSD()).to.equal(0);
        });

        it("Should not add new interest", async function () {
            const interest = 10000;
            const expectedInterestInUsd = interest * 1e9; // 18-9 decimalls
            cTokenMock.balanceOfUnderlying.returns(interest);
            await charityPool.setVariable('currentInterestEarned', {
                [cTokenMock.address]: interest
            });

            await charityPool.connect(iHelpMock.wallet).calculateTotalIncrementalInterest(cTokenMock.address);
            expect(await charityPool.newTotalInterestEarnedUSD()).to.equal(0);
            expect(await charityPool.totalInterestEarnedUSD()).to.equal(0);
        });

        it("Should calculate accountedBalanceUSD", async function () {
            const interest = 10000;
            const deposit = parseEther("200");
            const expectedBalanceInUsd = deposit;

            cTokenMock.balanceOfUnderlying.returns(deposit.add(interest));

            await charityPool.depositTokens(cTokenMock.address, deposit);
            await charityPool.connect(iHelpMock.wallet).calculateTotalIncrementalInterest(cTokenMock.address);

            expect(await charityPool.accountedBalanceUSD()).to.equal(expectedBalanceInUsd);
        });

        describe("Interest redeem", function () {
            beforeEach(async function () {
                iHelpMock.getFees.returns([100, 100, 800]);
            });
            it("Should redeem interest", async function () {
                const interest = 10000;
                await charityPool.setVariable('redeemableInterest', {
                    [cTokenMock.address]: interest
                });

                await charityPool.setVariable('currentInterestEarned', {
                    [cTokenMock.address]: interest
                });

                await cTokenMock.setVariable("_balances", {
                    [charityPool.address]: interest
                });

                cTokenMock.redeemUnderlying.returns(async () => {
                    await cTokenUnderlyingMock.setVariable("_balances", {
                        [CompoundConnector.address]: interest
                    })

                    await holdingMock.setVariable("_balances", {
                        [charityPool.address]: interest
                    })
                    return 0;
                });

                swapperMock.swap.returns(async () => { return interest; });

                await charityPool.connect(iHelpMock.wallet).calculateTotalIncrementalInterest(cTokenMock.address);
                expect(await charityPool.connect(iHelpMock.wallet, "it should emit rewarded").redeemInterest(cTokenMock.address)).to.emit(charityPool, "Rewarded");

                expect(await holdingMock.balanceOf(charityPool.address)).to.equal(interest * 0.8);
                expect(await holdingMock.balanceOf(developmentPool.address)).to.equal(interest * 0.1);
                expect(await holdingMock.balanceOf(stakingPool.address)).to.equal(interest * 0.1);

                expect(await charityPool.redeemableInterest(cTokenMock.address), "It should reset interest").to.equal(0);
            });

            it("Should not emit rewarded if no interest", async function () {
                const interest = 0;
                cTokenMock.balanceOfUnderlying.returns(interest);

                await charityPool.connect(iHelpMock.wallet).calculateTotalIncrementalInterest(cTokenMock.address);
                expect(await charityPool.connect(iHelpMock.wallet).redeemInterest(cTokenMock.address)).not.to.emit(charityPool, "Rewarded");
            });
        });
    });

    describe("Pow", function () {
        it("Should calculate exponents", async function () {
            expect(await charityPool.safepow(0, 0)).to.equal(1);
            expect(await charityPool.safepow(0, 1)).to.equal(0);
            expect(await charityPool.safepow(1, 0)).to.equal(1);
            expect(await charityPool.safepow(1, 1)).to.equal(1);
            expect(await charityPool.safepow(0, 123)).to.equal(0);
            expect(await charityPool.safepow(2, 3)).to.equal(8);
            expect(await charityPool.safepow(parseEther("0"), parseEther("0"))).to.equal(1);
            expect(await charityPool.safepow(10, 18)).to.equal((1e18).toFixed());
        });
    });
});