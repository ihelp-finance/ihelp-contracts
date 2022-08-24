// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

interface SwapperInterface {
    function nativeToken() external view returns (address);

    function swapByPath(
        address[] memory path,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to
    ) external returns (uint256);

    function swap(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to
    ) external returns (uint256);

    function getAmountOutMin(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external view returns (uint256);

    function getNativeRoutedTokenPrice(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external view returns (uint256);

    function getAmountsOutByPath(address[] memory _path, uint256 _amountIn) external view returns (uint256);
}
