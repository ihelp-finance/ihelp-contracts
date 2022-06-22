// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.9;

import "../ihelp/charitypools/CharityPool.sol";
import "../ihelp/iHelpToken.sol";
import "../ihelp/charitypools/CharityPoolUtils.sol";
import "./AnalyticsUtils.sol";

//pre

interface IAnalytics {
    /**
     * Calaculates the generated interest for a given charity
     */
    function generatedInterest(CharityPool _charityPool) external view returns (uint256);

    /**
     * Calaculates the total generated interest for all charities
     */
    function totalGeneratedInterest(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256);

    /**
     * Calaculates the total generated interest for a given yield protocol
     */
    function getYieldProtocolGeneratedInterest(
        iHelpToken _iHelp,
        address _cTokenAddress,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256);

    /**
     * Calaculates the total generated yield for a given charity
     */
    function getYieldProtocolGeneratedInterestByCharity(CharityPool _charity) external view returns (uint256);

    /**
     * Calaculates the total generated interest for a given underlying currency
     */
    function getUnderlyingCurrencyGeneratedInterest(
        iHelpToken _iHelp,
        address _underlyingCurrency,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256);

    /**
     * Calaculates generated interest for a given user
     */
    function getUserGeneratedInterest(
        iHelpToken _iHelp,
        address _account,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256);

    /**
     * Calaculates the total generated interest for a all users
     */
    function getTotalUserGeneratedInterest(iHelpToken _iHelp) external view returns (uint256);

    /**
     * Calaculates the total locked value over all charities
     */
    function totalLockedValue(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256);

    /**
     * Calaculates the total locked value of a charity
     */
    function totalCharityLockedValue(CharityPool _charity) external view returns (uint256);

    /**
     * Get total number of helpers
     */
    function totalHelpers(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256);

    /**
     * Get number of helpers in a given charity
     */
    function totalHelpersInCharity(CharityPool _charity) external view returns (uint256);

    /**
     * Get the total value of direct donations from all charities
     */
    function getTotalDirectDonations(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256);

    /**
     * Get the total USD value of direct donations for a helper
     */
    function getUserTotalDirectDonations(
        iHelpToken _iHelp,
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256);

    /**
     * Get the total value of direct donations for a helper
     */
    function getUserDirectDonationsStats(CharityPool _charity, address _user)
        external
        view
        returns (CharityPoolUtils.DirectDonationsCounter memory);

    /**
     * Return general statistics
     */
    function generalStats(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (AnalyticsUtils.GeneralStats memory);

    /**
     * Return general statistics for a given charity
     */
    function charityStats(CharityPool _charity) external view returns (AnalyticsUtils.CharityStats memory);

    /**
     * Return general statistics for a given user
     */
    function userStats(
        iHelpToken _iHelp,
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (AnalyticsUtils.UserStats memory);
}
