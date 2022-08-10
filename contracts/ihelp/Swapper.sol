// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "../utils/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "hardhat/console.sol";

contract Swapper is OwnableUpgradeable {
    //address of the swap router (uniswap v2 format)
    IUniswapV2Router02 public SWAP_ROUTER;

    address internal NATIVE_TOKEN;

    function initialize(address _swapRouter, address _nativeToken) public initializer {
        SWAP_ROUTER = IUniswapV2Router02(_swapRouter);
        NATIVE_TOKEN = _nativeToken;
    }
    
    function setRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Router cannot be null");
        SWAP_ROUTER = IUniswapV2Router02(newRouter);
    }
    
    function setNativeToken(address newNativeToken) external onlyOwner {
        require(newNativeToken != address(0), "Native token cannot be null");
        NATIVE_TOKEN = newNativeToken;
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
    ) external returns (uint256) {
        address[] memory path;
        
        if (_tokenIn == nativeToken()) {
            path = new address[](2);
            path[0] = _tokenIn;
            path[1] = _tokenOut;
        } else {
            path = new address[](3);
            path[0] = _tokenIn;
            path[1] = nativeToken();
            path[2] = _tokenOut;
        }

        return _swapByPath(path, _amountIn, _amountOutMin, _to);
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

    function nativeToken() public view returns (address) {
        return NATIVE_TOKEN;
    }

    function getAmountsOutByPath(address[] memory _path, uint256 _amountIn) public view returns (uint256) {
        if (_amountIn == 0) {
            return 0;
        }

        if (_path[0] == _path[_path.length - 1]) {
            return _amountIn;
        }

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

    /**
     * Get the price of a specific but proxyed through native liquidity
     */
    function getNativeRoutedTokenPrice(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external view returns (uint256) {
        address[] memory path;

        if (_tokenIn == SWAP_ROUTER.WETH() || _tokenOut == SWAP_ROUTER.WETH()) {
            path = new address[](2);
            path[0] = _tokenIn;
            path[1] = _tokenOut;
        } else {
            path = new address[](3);
            path[0] = _tokenIn;
            path[1] = SWAP_ROUTER.WETH();
            path[2] = _tokenOut;
        }

        return getAmountsOutByPath(path, _amountIn);
    }
}
