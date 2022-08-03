// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../utils/IERC20.sol";

interface PriceFeedProviderInterface {
    struct DonationCurrency {
        string provider;
        string currency;
        address underlyingToken;
        address lendingAddress;
        address priceFeed;
    }
    
    function allowedDirectDonationCurrencies(address _currencyAddr) external view returns (bool);
    function numberOfDonationCurrencies() external view returns (uint256);
    function getDonationCurrencyAt(uint256 index) external view returns (DonationCurrency memory);
    function getUnderlyingTokenPrice(address _lendingAddress) external view returns (uint256, uint256);
    function addDonationCurrencies(DonationCurrency[] memory _newDonationCurrencies) external;
    function updateDonationCurrency(DonationCurrency memory _donationCurrency) external;
    function removeDonationCurrency(address _lendingAddress) external;
    function getDonationCurrency(address _lendingAddress) external view returns (DonationCurrency memory);
    function hasDonationCurrency(address _lendingAddress) external view returns (bool);
    function setDirectDonationCurrency(address _currencyAddress, bool status) external;
    function getAllDonationCurrencies() external view returns (DonationCurrency[] memory);
}
