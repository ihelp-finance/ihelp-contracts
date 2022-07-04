// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../utils/IERC20.sol";

contract PriceFeedProvider is OwnableUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct DonationCurrency {
        string provider;
        address underlyingToken;
        address lendingAddress;
        address priceFeed;
    }

    mapping(address => DonationCurrency) private _donationCurrencies;
    EnumerableSet.AddressSet private _donationCurrencyMapping;

    /**
     * Initialzie the contract with a set of donation currencies
     */
    function initialize(DonationCurrency[] memory _initialDonationCurrencies) public initializer {
        __Ownable_init();
        for (uint256 i = 0; i < _initialDonationCurrencies.length; i++) {
            _donationCurrencyMapping.add(_initialDonationCurrencies[i].lendingAddress);
            _donationCurrencies[_initialDonationCurrencies[i].lendingAddress] = _initialDonationCurrencies[i];
        }
    }

    /**
     * Returns the underlying token price and the decimal number of the price value
     */
    function getUnderlyingTokenPrice(address _lendingAddress) public view virtual returns (uint256, uint256) {
        DonationCurrency memory currency = getDonationCurrency(_lendingAddress);
        AggregatorV3Interface priceFeed = AggregatorV3Interface(currency.priceFeed);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        uint256 decimals = uint256(priceFeed.decimals());
        return (uint256(price), decimals);
    }

    function addDonationCurrency(DonationCurrency memory _donationCurrency) public onlyOwner {
        require(_donationCurrency.lendingAddress != address(0), "price-feed/invalid-lending");
        require(_donationCurrency.underlyingToken != address(0), "price-feed/invalid-underlying");
        require(_donationCurrency.priceFeed != address(0), "price-feed/invalid-price-feed");
        require(!hasDonationCurrency(_donationCurrency.lendingAddress), "price-feed/already-exists");
        _donationCurrencyMapping.add(_donationCurrency.lendingAddress);
        _donationCurrencies[_donationCurrency.lendingAddress] = _donationCurrency;
    }

    function updateDonationCurrency(DonationCurrency memory _donationCurrency) public onlyOwner {
        require(_donationCurrency.lendingAddress != address(0), "price-feed/invalid-lending");
        require(_donationCurrency.underlyingToken != address(0), "price-feed/invalid-underlying");
        require(_donationCurrency.priceFeed != address(0), "price-feed/invalid-price-feed");
        require(hasDonationCurrency(_donationCurrency.lendingAddress), "price-feed/not-found");
        _donationCurrencies[_donationCurrency.lendingAddress] = _donationCurrency;
    }

    function removeDonationCurrency(address _lendingAddress) public onlyOwner {
        _donationCurrencyMapping.remove(_lendingAddress);
    }

    function getDonationCurrency(address _lendingAddress) public view returns (DonationCurrency memory) {
        require(_donationCurrencyMapping.contains(_lendingAddress), "price-feed/currency-not-found");
        return _donationCurrencies[_lendingAddress];
    }

    function hasDonationCurrency(address _lendingAddress) public view returns (bool) {
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
