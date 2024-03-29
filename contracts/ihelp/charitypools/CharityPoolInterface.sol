// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;
import "./CharityPoolUtils.sol";
import "../../utils/IERC20.sol";
import "../PriceFeedProviderInterface.sol";
import "../iHelpTokenInterface.sol";

interface CharityPoolInterface {    
    function name() external  view returns (string memory);
    function operator() external view returns (address);
    function charityWallet() external view returns (address);
    function swapperPool() external view returns (address);
    function holdingToken() external view returns (address);
    function totalDonationsUSD() external view returns (uint256);
    function transferOperator(address newOperator) external;
    function donationsRegistry(address _account) external view returns (CharityPoolUtils.DirectDonationsCounter memory);
    function setCharityWallet(address _newAddress) external;
    function developmentPool() external view returns (address);
    function stakingPool() external view returns (address);
    function depositNative(address _cTokenAddress, string memory _memo) external payable;
    function withdrawNative(address _cTokenAddress, uint256 _amount) external;
    function depositTokens(address _cTokenAddress, uint256 _amount, string memory _memo) external;
    function withdrawTokens(address _cTokenAddress, uint256 _amount) external;
    function withdrawAll(address _account) external;
    function directDonation(IERC20 _donationToken, uint256 _amount, string memory _memo) external;
    function claimInterest() external;
    function claimableInterest() external view returns (uint256);
    function collectOffChainInterest(address _destAddr, address _depositCurrency) external;
    function getUnderlying(address cTokenAddress) external view returns (IERC20);
    function balanceOf(address _account, address _cTokenAddress) external view returns (uint256);
    function estimatedInterestRate(uint256 _blocks, address _cTokenAddres) external view returns (uint256);
    function supplyRatePerBlock(address _cTokenAddress) external view returns (uint256);
    function getUnderlyingTokenPrice(address _cTokenAdddress) external view returns (uint256, uint256);
    function getContributors() external view returns (address[] memory);
    function accountedBalanceUSD() external view returns (uint256);
    function accountedBalanceUSDOfCurrencies(PriceFeedProviderInterface.DonationCurrency[] memory cTokens) external view returns(uint256);
    function totalInterestEarnedUSD() external view returns (uint256);
    function cTokenTotalUSDInterest(address _cTokenAddress) external view returns (uint256);
    function decimals(address _cTokenAddress) external view returns (uint8);
    function getAllDonationCurrencies() external view returns (PriceFeedProviderInterface.DonationCurrency[] memory);
    function balanceOfUSD(address _addr) external view returns (uint256);
    function numberOfContributors() external view returns (uint256);
    function contributorAt(uint256 index) external view returns (address);
    function directDonationNative(string memory _memo) external payable;
    function version() external pure returns (uint256);
    function balances(address _account, address _cToken) external view returns (uint256);
    function donationBalances(address _account, address _cToken) external view returns (uint256);
    function accountedBalances(address _account) external view returns (uint256);
    function totalInterestEarned(address _account) external view returns (uint256);
    function currentInterestEarned(address _account) external view returns (uint256);
    function lastTotalInterest(address _account) external view returns (uint256);
    function newTotalInterestEarned(address _account) external view returns (uint256);
    function redeemableInterest(address _account) external view returns (uint256);
    function priceFeedProvider() external view returns (PriceFeedProviderInterface);
    function ihelpToken() external view returns (iHelpTokenInterface);
    // function incrementTotalInterest() external;
}
