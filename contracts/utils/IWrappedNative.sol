// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;
import "./IERC20.sol";

interface IWrappedNative is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 _amount) external;
}