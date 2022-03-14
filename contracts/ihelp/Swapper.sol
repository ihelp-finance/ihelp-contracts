// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "../utils/IERC20.sol";

import "hardhat/console.sol";

//import the uniswap router
//the contract needs to use swapExactTokensForTokens
//this will allow us to import swapExactTokensForTokens into our contract

interface IUniswapV2Router {
  function getAmountsOut(uint256 amountIn, address[] memory path)
  external
  view
  returns(uint256[] memory amounts);

  function swapExactTokensForTokens(

    //amount of tokens we are sending in
    uint256 amountIn,
    //the minimum amount of tokens we want out of the trade
    uint256 amountOutMin,
    //list of token addresses we are going to trade in.  this is necessary to calculate amounts
    address[] calldata path,
    //this is the address we are going to send the output tokens to
    address to,
    //the last time that the trade is valid for
    uint256 deadline
  ) external returns(uint256[] memory amounts);
  
  
  function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
  external
  payable
  returns (uint[] memory amounts);
  
}

interface IUniswapV2Pair {
  function token0() external view returns(address);

  function token1() external view returns(address);

  function swap(
    uint256 amount0Out,
    uint256 amount1Out,
    address to,
    bytes calldata data
  ) external;
}

interface IUniswapV2Factory {
  function getPair(address token0, address token1) external returns(address);
}



contract Swapper {

  //address of the swap router (uniswap v2 format)
  address private SWAP_ROUTER;
  
  // rinkeby WETH address
  //address private WETH;
  
  function initialize (
    address _swapRouter
  ) public {
      SWAP_ROUTER = _swapRouter;
  }

  //this swap function is used to trade from one token to another
  //the inputs are self explainatory
  //token in = the token address you want to trade out of
  //token out = the token address you want as the output of this trade
  //amount in = the amount of tokens you are sending in
  //amount out Min = the minimum amount of tokens you want out of the trade
  //to = the address you want the tokens to be sent to

  function swap(address _tokenIn, address _tokenOut, uint256 _amountIn, uint256 _amountOutMin, address _to) external {

    console.log('calling swapper...');

    //first we need to transfer the amount in tokens from the msg.sender to this contract
    //this contract will have the amount of in tokens
    IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);

    //next we need to allow the uniswapv2 router to spend the token we just sent to this contract
    //by calling IERC20 approve you allow the uniswap contract to spend the tokens in this contract 
    IERC20(_tokenIn).approve(SWAP_ROUTER, _amountIn);

    address[] memory path;
    path = new address[](2);
    path[0] = _tokenIn;
    path[1] = _tokenOut;

    //then we will call swapExactTokensForTokens
    //for the deadline we will pass in block.timestamp
    //the deadline is the latest time the trade is valid for
    IUniswapV2Router(SWAP_ROUTER).swapExactTokensForTokens(_amountIn, _amountOutMin, path, _to, block.timestamp);
  }
  
  // function swapEth(address _tokenOut, uint256 _amountOutMin, address _to) external payable {
  //   address[] memory path;
  //   path = new address[](2);
  //   path[0] = WETH;
  //   path[1] = _tokenOut;
  //   //then we will call swapExactETHForTokens
  //   //for the deadline we will pass in block.timestamp
  //   //the deadline is the latest time the trade is valid for
  //   IUniswapV2Router(SWAP_ROUTER).swapExactETHForTokens{value: msg.value}(_amountOutMin, path, _to, block.timestamp);
  // }

  function getAmountOutMin(address _tokenIn, address _tokenOut, uint256 _amountIn) external view returns(uint256) {

    address[] memory path;
    path = new address[](2);
    path[0] = _tokenIn;
    path[1] = _tokenOut;

    uint256[] memory amountOutMins = IUniswapV2Router(SWAP_ROUTER).getAmountsOut(_amountIn, path);
    return amountOutMins[path.length - 1];
  }
}