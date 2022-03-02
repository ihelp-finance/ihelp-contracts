// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import "../utils/IERC20.sol";

interface CharityPoolInterface is IERC20 {
    function getCharityWallet() external view returns (address);
    function tokenname() external view returns (string memory);
    function decimals() external view override returns (uint8);
    function totalInterestEarned() external view returns (uint256);
    function totalInterestEarnedUSD() external view returns (uint256);
    function getUnderlyingTokenPrice() external view returns (uint256);
    function calculateTotalIncrementalInterest() external;
    function redeemInterest() external;
    function newTotalInterestEarned() external view returns (uint256);
    function newTotalInterestEarnedUSD() external view returns (uint256);
    function getAccountedBalance() external view returns (uint256);
    function getAccountedBalanceUSD() external view returns (uint256);
    function balanceOfUSD(address _addr) external view returns (uint256);
    function getContributors() external returns (address[] memory);
}
