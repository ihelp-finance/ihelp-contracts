const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers/lib/utils");
const { smock } = require("@defi-wonderland/smock");
use(smock.matchers);
describe("Swapper", function () {
    let Swapper;
    let swapper;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let mockToken1, mockToken2, routerFake;


    beforeEach(async function () {
        Swapper = await smock.mock("Swapper");
        const Mock = await smock.mock("ERC20MintableMock");

        mockToken1 = await Mock.deploy("Mock1", "MOK1", 18);
        mockToken2 = await Mock.deploy("Mock2", "MOK2", 18);

        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        routerFake = await smock.fake([
            'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
            'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
            'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
            'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external  payable returns (uint[] memory amounts)',
            'function swapExactETHForTokens( uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
            'function swapExactETHForTokensSupportingFeeOnTransferTokens( uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
        ], { address: addr1.address });

        swapper = await Swapper.deploy();
        await swapper.initialize(routerFake.address);
        await mockToken1.mint(owner.address, parseEther('1000000000000000000'));

        await mockToken1.approve(swapper.address, parseEther('1000000000000000000'));
    });

    describe("Deployment", function () {
        it("Initialize the swapper", async function () {
            expect(await swapper.SWAP_ROUTER()).to.equal(addr1.address);
        });
    });

    describe("Eouter swap function", function () {
        it("Should call router swap function", async function () {
            routerFake.swapExactTokensForTokens.returns();
            await swapper.swap(mockToken1.address, mockToken2.address, 200, 100, owner.address);

            expect(mockToken1.transferFrom).to.be.calledOnceWith(owner.address, swapper.address, 200);
            expect(mockToken1.approve.atCall(1)).to.have.been.calledWith(routerFake.address, 200);
            const blockBefore = await ethers.provider.getBlock();
            const timestampBefore = blockBefore.timestamp;


            expect(routerFake.swapExactTokensForTokens.getCall(0).args[0]).to.equal(200);
            expect(routerFake.swapExactTokensForTokens.getCall(0).args[1]).to.equal(100);
            expect(routerFake.swapExactTokensForTokens.getCall(0).args[2][0]).to.be.equal(mockToken1.address);
            expect(routerFake.swapExactTokensForTokens.getCall(0).args[2][1]).to.be.equal(mockToken2.address);
            expect(routerFake.swapExactTokensForTokens.getCall(0).args[3]).to.be.equal(owner.address);
            expect(routerFake.swapExactTokensForTokens.getCall(0).args[4]).to.be.gt(timestampBefore);

        });

        it("Should call router getAmounts out function", async function () {
            routerFake.getAmountsOut.returns([1, 200]);
            const amountOut = await swapper.getAmountOutMin(mockToken1.address, mockToken2.address, 100);

            expect(amountOut).to.equal(200);

            expect(routerFake.getAmountsOut.getCall(0).args[0]).to.equal(100);
            expect(routerFake.getAmountsOut.getCall(0).args[1][0]).to.be.equal(mockToken1.address);
            expect(routerFake.getAmountsOut.getCall(0).args[1][1]).to.be.equal(mockToken2.address);
        });
    });

});