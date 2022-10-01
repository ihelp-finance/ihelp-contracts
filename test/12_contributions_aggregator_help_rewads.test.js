const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const AggregatorV3JSON = require("../artifacts/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface.json");
const { parseEther } = require('ethers/lib/utils');

use(smock.matchers);

describe("Contributions aggregator -- iHelp rewards", function () {
    let owner, charity;
    let contributor, secondContributor, thirdContributor;
    let contributionsAggregator;
    let priceFeedProviderMock;
    let iHelpMock;
    let compoundConnector, aggregator;
    let lenderTokenUnderlyingMock, lenderTokenMock, holdingToken

    beforeEach(async function () {
        [owner, charity, contributor, secondContributor, thirdContributor, ...addrs] = await ethers.getSigners();

        let SwapperUtils = await ethers.getContractFactory("SwapperUtils");
        SwapperUtils = await SwapperUtils.deploy();

        // ===== Intialize a Connector =====
        const ProtocolConnector = await smock.mock("CompoundConnector");
        compoundConnector = await ProtocolConnector.deploy();
        await compoundConnector.initialize();

        // ===== Intialize lender tokens =====
        const Mock = await smock.mock("ERC20MintableMock");
        const LenderTokenMock = await smock.mock("CTokenMock");
        holdingToken = await Mock.deploy("Holding", "HODL", 18);

        lenderTokenUnderlyingMock = await Mock.deploy("Mock", "MOK", 18);
        lenderTokenMock = await LenderTokenMock.deploy(lenderTokenUnderlyingMock.address, 1000);

        // ===== Intialize a PriceFeedProvider =====
        const PriceFeedProvider = await smock.mock("PriceFeedProviderMock");
        priceFeedProviderMock = await PriceFeedProvider.deploy();

        aggregator = await smock.fake(AggregatorV3JSON.abi);
        aggregator.latestRoundData.returns([0, 1e9, 0, 0, 0]);

        await priceFeedProviderMock.initialize([{
            provider: "TestProvider",
            lendingAddress: lenderTokenMock.address,
            currency: "lenderTokenMock",
            underlyingToken: lenderTokenUnderlyingMock.address,
            priceFeed: aggregator.address,
            connector: compoundConnector.address
        }]);

        // ===== Intialize a iHelp Token  =====
        iHelpMock = await smock.fake("iHelpToken");
        iHelpMock.priceFeedProvider.returns(priceFeedProviderMock.address);
        iHelpMock.underlyingToken.returns(holdingToken.address);
        iHelpMock.hasCharity.returns(true);
        
        // ===== Intialize a Swapper =====
        swapperMock = await smock.fake("Swapper");

        const ContributionsAggregator = await smock.mock("ContributionsAggregatorExtended", {
            libraries: {
                SwapperUtils: SwapperUtils.address
            }
        });

        contributionsAggregator = await ContributionsAggregator.deploy();
        await contributionsAggregator.initialize(iHelpMock.address, swapperMock.address);
    })

    describe('IHelp Rewards', () => {
        beforeEach(async () => {
            await lenderTokenUnderlyingMock.mint(contributor.address, 10000);
            await lenderTokenUnderlyingMock.connect(contributor).increaseAllowance(contributionsAggregator.address, parseEther('1000'));

            await lenderTokenUnderlyingMock.mint(secondContributor.address, 10000);
            await lenderTokenUnderlyingMock.connect(secondContributor).increaseAllowance(contributionsAggregator.address, parseEther('1000'));

            await lenderTokenUnderlyingMock.mint(thirdContributor.address, 10000);
            await lenderTokenUnderlyingMock.connect(thirdContributor).increaseAllowance(contributionsAggregator.address, parseEther('1000'));

            iHelpMock.underlyingToken.returns(lenderTokenUnderlyingMock.address);

        })

        describe('Flow for 1 contributor', () => {
            it('should calculate the correct IHelp rewards for 1 contributor', async () => {
                await contributionsAggregator.connect(contributor).deposit(lenderTokenMock.address, charity.address, contributor.address, 1000);
                await contributionsAggregator.distributeIHelp(100);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(100);
            })

            it('should claim the correct IHelp rewards for 1 contributor', async () => {
                await contributionsAggregator.connect(contributor).deposit(lenderTokenMock.address, charity.address, contributor.address, 1000);
                await contributionsAggregator.distributeIHelp(100);

                await expect(contributionsAggregator.claimIHelpReward(contributor.address, 100)).
                    to.emit(contributionsAggregator, "IHelpClaimed")
                    .withArgs(contributor.address, 100);
            })

            it('should fail to claim more tokens than earned', async () => {
                await contributionsAggregator.connect(contributor).deposit(lenderTokenMock.address, charity.address, contributor.address, 1000);
                await contributionsAggregator.distributeIHelp(100);

                expect(contributionsAggregator.claimIHelpReward(contributor.address, 200)).
                    to.be.revertedWith("ihelp-claim/insuficient balance");
            })
        })

        describe('Flow for multiple contributors', () => {
            it('should calculate the correct rewards', async () => {
                await contributionsAggregator.connect(contributor).deposit(lenderTokenMock.address, charity.address, contributor.address, 1000);
                await contributionsAggregator.connect(secondContributor).deposit(lenderTokenMock.address, charity.address, secondContributor.address, 1000);

                await contributionsAggregator.distributeIHelp(200);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(100);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(100);

                await contributionsAggregator.connect(contributor).withdraw(lenderTokenMock.address, charity.address, contributor.address, 1000, contributor.address);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(100);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(100);

                await contributionsAggregator.distributeIHelp(200);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(100);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(300);

                await contributionsAggregator.connect(secondContributor).withdraw(lenderTokenMock.address, charity.address, secondContributor.address, 1000, secondContributor.address);

                await contributionsAggregator.distributeIHelp(200);
                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(100);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(300);

                await contributionsAggregator.connect(thirdContributor).deposit(lenderTokenMock.address, charity.address, thirdContributor.address, 1000);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(100);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(300);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(0);

                await contributionsAggregator.distributeIHelp(200);
                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(100);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(300);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(200);

                await contributionsAggregator.connect(secondContributor).deposit(lenderTokenMock.address, charity.address, secondContributor.address, 1000);
                await contributionsAggregator.distributeIHelp(200);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(100);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(400);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(300);

                await contributionsAggregator.distributeIHelp(200);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(100);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(500);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(400);

                await contributionsAggregator.connect(contributor).deposit(lenderTokenMock.address, charity.address, contributor.address, 1000);
                await contributionsAggregator.distributeIHelp(300);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(200);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(600);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(500);

                await contributionsAggregator.connect(contributor).deposit(lenderTokenMock.address, charity.address, contributor.address, 1000);
                await contributionsAggregator.distributeIHelp(200);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(300);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(650);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(550);

                await contributionsAggregator.connect(contributor).withdraw(lenderTokenMock.address, charity.address, contributor.address, 1000, contributor.address);
                await contributionsAggregator.distributeIHelp(300);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(400);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(750);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(650);

            })

            it('should execute correct deposits and reward claims', async () => {
                await contributionsAggregator.connect(contributor).deposit(lenderTokenMock.address, charity.address, contributor.address, 1000);
                await contributionsAggregator.distributeIHelp(100);

                await contributionsAggregator.connect(secondContributor).deposit(lenderTokenMock.address, charity.address, secondContributor.address, 1000);
                await contributionsAggregator.distributeIHelp(200);

                await contributionsAggregator.connect(thirdContributor).deposit(lenderTokenMock.address, charity.address, thirdContributor.address, 1000);
                await contributionsAggregator.distributeIHelp(300);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(300);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(200);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(100);

                contributionsAggregator.claimIHelpReward(contributor.address, 100)
                contributionsAggregator.claimIHelpReward(secondContributor.address, 100)
                contributionsAggregator.claimIHelpReward(thirdContributor.address, 100)

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(200);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(100);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(0);

                await contributionsAggregator.distributeIHelp(300);

                contributionsAggregator.claimIHelpReward(contributor.address, 300)
                contributionsAggregator.claimIHelpReward(secondContributor.address, 200)
                contributionsAggregator.claimIHelpReward(thirdContributor.address, 100)

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(0);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(0);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(0);

            })

            it('should execute correct deposits, withdrawals and reward claims', async () => {
                await contributionsAggregator.connect(contributor).deposit(lenderTokenMock.address, charity.address, contributor.address, 1000);
                await contributionsAggregator.distributeIHelp(100);

                await contributionsAggregator.connect(secondContributor).deposit(lenderTokenMock.address, charity.address, secondContributor.address, 1000);
                await contributionsAggregator.distributeIHelp(200);

                contributionsAggregator.claimIHelpReward(contributor.address, 100);
                contributionsAggregator.claimIHelpReward(secondContributor.address, 50);

                await contributionsAggregator.connect(contributor).withdraw(lenderTokenMock.address, charity.address, contributor.address, 500, contributor.address);
               
                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(100);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(50);

                await contributionsAggregator.distributeIHelp(100);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(133);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(116);

                await contributionsAggregator.connect(contributor).deposit(lenderTokenMock.address, charity.address, contributor.address, 500);
                await contributionsAggregator.connect(secondContributor).deposit(lenderTokenMock.address, charity.address, secondContributor.address, 1000);
                await contributionsAggregator.connect(thirdContributor).deposit(lenderTokenMock.address, charity.address, thirdContributor.address, 1000);

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(133);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(116);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(0);

                await contributionsAggregator.distributeIHelp(200);
                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(183);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(216);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(50);

                contributionsAggregator.claimIHelpReward(contributor.address, 183)
                contributionsAggregator.claimIHelpReward(secondContributor.address, 216)

                await contributionsAggregator.distributeIHelp(200);
                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(50);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(100);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(100);

                await contributionsAggregator.connect(contributor).withdraw(lenderTokenMock.address, charity.address, contributor.address, 1000, contributor.address);
                await contributionsAggregator.connect(secondContributor).withdraw(lenderTokenMock.address, charity.address, secondContributor.address, 1000, secondContributor.address);
                
                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(50);

                await contributionsAggregator.distributeIHelp(200);

                contributionsAggregator.claimIHelpReward(contributor.address, 50)

                expect(await contributionsAggregator.claimableIHelpRewardOf(contributor.address)).to.equal(0);
                expect(await contributionsAggregator.claimableIHelpRewardOf(secondContributor.address)).to.equal(200);
                expect(await contributionsAggregator.claimableIHelpRewardOf(thirdContributor.address)).to.equal(200);
            })
        });

    })
})