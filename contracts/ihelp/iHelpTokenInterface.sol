// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "../utils/IERC20.sol";

interface iHelpTokenInterface is IERC20 {
    function interestGenerated() external view returns (uint256);
    function getUnderlyingToken() external view returns (IERC20);
    function contributorGeneratedInterest(address _user, address _charity) external view returns (uint256);
    function stakingPool() external view returns (address);
    function developmentPool() external view returns (address);
    function getPools() external view returns (address, address);
    function getFees() external view returns(uint256, uint256, uint256);
    function getDirectDonationFees() external view returns(uint256, uint256, uint256);
    function numberOfCharities() external view returns (uint256);
    function charityAt(uint256 index) external view returns (address);
    function priceFeedProvider() external view returns (address);
    function totalContributorGeneratedInterest() external view returns (uint256);
    function underlyingToken() external view returns (address);
    function totalCirculating() external view returns (uint256);
    function numberOfContributors() external view returns (uint256);
    function contributorAt(uint256 _index) external view returns(address, uint256);
    function notifyBalanceUpdate(address _account, uint256 _amount, bool _increased) external;
    function withdrawBulk(address[] calldata _charities) external;
}
