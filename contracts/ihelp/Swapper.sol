// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "../utils/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Swapper is OwnableUpgradeable {
    //address of the swap router (uniswap v2 format)
    IUniswapV2Router02 public SWAP_ROUTER;

    function initialize(address _swapRouter) public initializer {
        SWAP_ROUTER = IUniswapV2Router02(_swapRouter);
    }

    function setRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Router cannot be null");
        SWAP_ROUTER = IUniswapV2Router02(newRouter);
    }

    //this swap function is used to trade from one token to another
    //the inputs are self explainatory
    //token in = the token address you want to trade out of
    //token out = the token address you want as the output of this trade
    //amount in = the amount of tokens you are sending in
    //amount out Min = the minimum amount of tokens you want out of the trade
    //to = the address you want the tokens to be sent to

    function swap(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to
    ) external {
        address[] memory path;
        path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;

        _swapByPath(path, _amountIn, _amountOutMin, _to);
    }

    function swapByPath(
        address[] memory path,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to
    ) external returns (uint256) {
        return _swapByPath(path, _amountIn, _amountOutMin, _to);
    }

    /**
        Performs a swapdefined by a specific swap path
     */
    function _swapByPath(
        address[] memory path,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to
    ) internal returns (uint256) {
        //first we need to transfer the amount in tokens from the msg.sender to this contract
        //this contract will have the amount of in tokens
        IERC20(path[0]).transferFrom(msg.sender, address(this), _amountIn);

        //next we need to allow the uniswapv2 router to spend the token we just sent to this contract
        //by calling IERC20 approve you allow the uniswap contract to spend the tokens in this contract
        IERC20(path[0]).approve(address(SWAP_ROUTER), _amountIn);

        //then we will call swapExactTokensForTokens
        //for the deadline we will pass in block.timestamp
        //the deadline is the latest time the trade is valid for
        uint256[] memory result = SWAP_ROUTER.swapExactTokensForTokens(_amountIn, _amountOutMin, path, _to, block.timestamp + 5 minutes);
        return result[path.length - 1];
    }

    function nativeToken() external view returns (address) {
        return SWAP_ROUTER.WETH();
    }


    function getAmountsOutByPath(address[] memory _path, uint256 _amountIn) public view returns (uint256) {
        uint256[] memory amountOutMins = IUniswapV2Router02(SWAP_ROUTER).getAmountsOut(_amountIn, _path);
        return amountOutMins[_path.length - 1];
    }

     function getAmountOutMin(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external view returns (uint256) {
        address[] memory path;
        path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;

       return getAmountsOutByPath(path, _amountIn);
    }
}
