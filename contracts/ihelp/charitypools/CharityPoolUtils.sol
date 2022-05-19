// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

library CharityPoolUtils {
    struct CharityPoolConfiguration {
        string charityName;
        address operatorAddress;
        address holdingPoolAddress;
        address charityWalletAddress;
        string charityTokenName;
        address cTokenAddress;
        address holdingTokenAddress;
        address priceFeedAddress;
        address ihelpAddress;
        address swapperAddress;
        address stakingPoolAddress;
        address developmentPoolAddress;
    }
}
