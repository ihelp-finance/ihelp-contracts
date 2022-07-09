// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "../utils/IERC20.sol";

interface iHelpTokenInterface is IERC20 {
    function interestGenerated() external view returns (uint256);
    function getUnderlyingToken() external view returns (IERC20);
    function getStakingPool() external view returns (address);
    function getHoldingPool() external view returns (address);
    function getFees() external view returns(uint256, uint256, uint256);
}
