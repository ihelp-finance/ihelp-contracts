// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

library AnalyticsUtils {
    struct GeneralStats {
        uint256 totalValueLocked;
        uint256 totalInterestGenerated;
        uint256 totalHelpers;
        uint256 totalCharities;
    }

    struct CharityStats {
        uint256 totalValueLocked;
        uint256 totalYieldGenerated;
        uint256 numerOfContributors;
        uint256 totalDirectDonations;
    }

    struct UserStats {
        uint256 totalDirectDonations;
        uint256 totalInterestGenerated;
        uint256 totalContributions;
    }
}
