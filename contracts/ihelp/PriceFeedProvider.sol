// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../utils/IERC20.sol";

contract PriceFeedProvider is OwnableUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct DonationCurrency {
        address underlyingToken;
        address lendingAddress;
        string provider;
        address priceFeed;
    }

    mapping(address => DonationCurrency) private _donationCurrencies;
    EnumerableSet.AddressSet private _donationCurrencyMapping;

    /**
     * Initialzie the contract with a set of donation currencies
     */
    function initialze(DonationCurrency[] memory _initialDonationCurrencies) public initializer {
        for (uint i = 0; i < _initialDonationCurrencies.length; i++) {
            addDonationCurrency(_initialDonationCurrencies[i]);
        }
    }

    function getUnderlyingTokenPrice(address _lendingAddress) public view  returns(uint256) {
        DonationCurrency memory currency = getDonationCurrency(_lendingAddress);
        AggregatorV3Interface priceFeed = AggregatorV3Interface(currency.priceFeed);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return uint256(price);
    }
    
    function addDonationCurrency(DonationCurrency memory _donationCurrency) public onlyOwner {
        _donationCurrencyMapping.add(_donationCurrency.lendingAddress);
        _donationCurrencies[_donationCurrency.lendingAddress] = _donationCurrency;
    }

    function removeDonationCurrency(address _lendingAddress) public onlyOwner {
        _donationCurrencyMapping.remove(_lendingAddress);
    }

    function getDonationCurrency(address _lendingAddress) public view returns (DonationCurrency memory) {
        require(_donationCurrencyMapping.contains(_lendingAddress) , "price-feed/currency-not-found");
        return _donationCurrencies[_lendingAddress];
    }

    function hasDonationCurrency(address _lendingAddress) public view returns(bool) {
        return _donationCurrencyMapping.contains(_lendingAddress);
    }

    function getAllDonationCurrencies() public view returns (DonationCurrency[] memory) {
        DonationCurrency[] memory result = new DonationCurrency[](_donationCurrencyMapping.length());
        for (uint256 i = 0; i < _donationCurrencyMapping.length(); i++) {
            result[i] = _donationCurrencies[_donationCurrencyMapping.at(i)];
        }
        return result;
    }
}
