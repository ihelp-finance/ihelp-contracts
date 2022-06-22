// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

library CharityPoolUtils {
    struct CharityPoolConfiguration {
        string charityName;
        address operatorAddress;
        address holdingPoolAddress;
        address charityWalletAddress;
        address holdingTokenAddress;
        address priceFeedAddress;
        address ihelpAddress;
        address swapperAddress;
        address stakingPoolAddress;
        address developmentPoolAddress;
        address wrappedNativeAddress;
    }

    struct DirectDonationsCounter {
        uint256 totalContribNativeToken; // TODO: Ask Ask mat how should we keep track of each native token?
        uint256 totalContribUSD;
        uint256 contribAfterSwapUSD;
        uint256 charityDonationUSD;
        uint256 devContribUSD;
        uint256 stakeContribUSD;
        uint256 totalDonations;
    }

}
