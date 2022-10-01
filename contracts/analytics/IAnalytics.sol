// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "../ihelp/charitypools/CharityPoolInterface.sol";
import "../ihelp/iHelpTokenInterface.sol";
import "../ihelp/charitypools/CharityPoolUtils.sol";
import "./AnalyticsUtils.sol";

interface IAnalytics {
    /**
     * Calaculates the generated interest for a given charity
     */
    function generatedInterest(address _charityPool) external view returns (uint256);

    /**
     * Calaculates the total generated interest for all charities
     */
    function totalGeneratedInterest(iHelpTokenInterface _iHelp) external view returns (uint256);

    /**
     * Calaculates the total generated interest for a given yield protocol
     */
    function getYieldProtocolGeneratedInterest(iHelpTokenInterface _iHelp, address _cTokenAddress)
        external
        view
        returns (uint256);

    /**
     * Calaculates the total generated yield for a given charity
     */
    function getYieldProtocolGeneratedInterestByCharity(CharityPoolInterface _charity) external view returns (uint256);

    /**
     * Calaculates the total generated interest for a given underlying currency
     */
    function getUnderlyingCurrencyGeneratedInterest(
        iHelpTokenInterface _iHelp,
        address _underlyingCurrency
    ) external view returns (uint256);

    /**
     * Calaculates generated interest for a given user
     */
    function getUserGeneratedInterest(
        iHelpTokenInterface _iHelp,
        address _account
    ) external view returns (uint256);

    /**
     * Calaculates the total generated interest for a all users
     */
    function getTotalUserGeneratedInterest(iHelpTokenInterface _iHelp) external view returns (uint256);

    /**
     * Calaculates the total locked value over all charities
     */
    function totalLockedValue(
        iHelpTokenInterface _iHelp
    ) external view returns (uint256);

    /**
     * Calaculates the total locked value of a charity
     */
    function totalCharityLockedValue(CharityPoolInterface _charity) external view returns (uint256);

    /**
     * Get total number of helpers
     */
    function totalHelpers(iHelpTokenInterface _iHelp) external view returns (uint256);

    /**
     * Get number of helpers in a given charity
     */
    function totalHelpersInCharity(CharityPoolInterface _charity) external view returns (uint256);

    /**
     * Get the total value of direct donations from all charities
     */
    function getTotalDirectDonations(
        iHelpTokenInterface _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256);

    /**
     * Get the total USD value of direct donations for a helper
     */
    function getUserTotalDirectDonations(
        iHelpTokenInterface _iHelp,
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256);

    /**
     * Get the total value of direct donations for a helper
     */
    function getUserDirectDonationsStats(CharityPoolInterface _charity, address _user)
        external
        view
        returns (CharityPoolUtils.DirectDonationsCounter memory);

    /**
     * Return general statistics
     */
    function generalStats(
        iHelpTokenInterface _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (AnalyticsUtils.GeneralStats memory);

    /**
     * Return general statistics for a given charity
     */
    function charityStats(CharityPoolInterface _charity) external view returns (AnalyticsUtils.CharityStats memory);

    /**
     * Return general statistics for a given user
     */
    function userStats(
        iHelpTokenInterface _iHelp,
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (AnalyticsUtils.UserStats memory);

    /**
     * Return iHelp related wallet information
     */
    function walletInfo(
        iHelpTokenInterface _iHelp,
        address _user,
        address _xHelpAddress
    ) external view returns (AnalyticsUtils.WalletInfo memory);

    /**
     * Returns an array with all the charity pools and their contributions
     */
    function getCharityPoolsWithContributions(
        iHelpTokenInterface _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (AnalyticsUtils.IndividualCharityContributionInfo[] memory);

    /**
     * Returns an array that contains the charity contribution info for a given user
     */
    function getUserContributionsPerCharity(
        iHelpTokenInterface _iHelp,
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (AnalyticsUtils.UserCharityContributions[] memory);

    /**
     * Returns an array that contains the charity contribution info for a given user
     */
    function getUserTokenContributionsPerCharity(CharityPoolInterface _charity, address _user)
        external
        view
        returns (AnalyticsUtils.UserCharityTokenContributions[] memory);

    /**
     * Returns an array that contains the charity donations info for a given user
     */
    function getUserTokenDonationsPerCharity(CharityPoolInterface _charity, address _user)
        external
        view
        returns (AnalyticsUtils.UserCharityTokenContributions[] memory);

    /**
     * Returns the user wallet balances of all supported donation currencies
     */
    function getUserWalletBalances(iHelpTokenInterface _iHelp, address _user)
        external
        view
        returns (AnalyticsUtils.WalletBalance[] memory);

    /**
     * Get charity pools balances and addresses
     */
    function getCharityPoolsAddressesAndBalances(
        iHelpTokenInterface _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (AnalyticsUtils.CharityBalanceInfo[] memory);

    /**
     * Get the state of the staking pool
     */
    function stakingPoolState(iHelpTokenInterface _iHelp, address xHelpAddress)
        external
        view
        returns (AnalyticsUtils.StakingPoolStats memory);
}
