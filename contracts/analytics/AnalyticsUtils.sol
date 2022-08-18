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

    struct IndividualCharityContributionInfo {
        string charityName;
        address charityAddress;
        uint256 totalContributions;
        uint256 totalDonations;
        uint256 totalInterestGenerated;
    }

     struct CharityContributor {
        address contributorAddress;
        uint256 totalContributions;
        uint256 totalDonations;
        uint256 totalDonationsCount;
        uint256 totalInterestGenerated;
    }

    struct StakingPoolStats {
        uint256 iHelpTokensInCirculation;
        uint256 iHelpStaked;
    }

    struct UserStats {
        uint256 totalDonationsCount;
        uint256 totalDirectDonations;
        uint256 totalInterestGenerated;
        uint256 totalContributions;
    }

    struct WalletInfo {
        uint256 iHelpBalance;
        uint256 xHelpBalance;
        uint256 stakingAllowance;
    }

    struct UserCharityContributions {
        string charityName;
        address charityAddress;
        uint256 totalContributions;
        uint256 totalDonations;
        uint256 yieldGenerated;
        UserCharityTokenContributions[] tokenStatistics;
    }

    struct UserCharityTokenContributions {
        address tokenAddress;
        string currency;
        uint256 totalContributions;
        uint256 totalContributionsUSD;
    }

    struct CharityBalanceInfo {
        address charityAddress;
        string charityName;
        uint256 balance;
    }

    struct WalletBalance {
        address tokenAddress;
        string currency;
        uint256 balance;
    }

    struct WalletAllowance {
        address tokenAddress;
        string currency;
        uint256 allowance;
    }

    struct DonationCurrencyDetails {
        string provider;
        string currency;
        address underlyingToken;
        address lendingAddress;
        address priceFeed;
        uint256 price;
        uint256 priceDecimals;
        uint256 decimals;
        uint256 apr;
    }
}
