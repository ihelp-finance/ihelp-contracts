// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../utils/IERC20.sol";
import "./PriceFeedProviderInterface.sol";

contract PriceFeedProvider is PriceFeedProviderInterface, OwnableUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;

    mapping(address => DonationCurrency) private _donationCurrencies;
    EnumerableSet.AddressSet private _donationCurrencyMapping;

    mapping(address => bool) public allowedDirectDonationCurrencies;
    /**
     * Initialzie the contract with a set of donation currencies
     */
    function initialize(DonationCurrency[] memory _initialDonationCurrencies) public initializer {
        __Ownable_init();
        for (uint256 i = 0; i < _initialDonationCurrencies.length; i++) {
            _addDonationCurrency(_initialDonationCurrencies[i]);
        }
    }

    /**
     * Get the total number of donation currencies
     */
    function numberOfDonationCurrencies() public view returns (uint256) {
        return _donationCurrencyMapping.length();
    }

    /**
     * Get the donation currency at a speciffic index
     */
    function getDonationCurrencyAt(uint256 index) public view returns (DonationCurrency memory) {
        return getDonationCurrency(_donationCurrencyMapping.at(index));
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

    function addDonationCurrencies(DonationCurrency[] memory _newDonationCurrencies) public onlyOwner {
         for (uint256 i = 0; i < _newDonationCurrencies.length; i++) {
            _addDonationCurrency(_newDonationCurrencies[i]);
        }
    }

    function _addDonationCurrency(DonationCurrency memory _donationCurrency) internal {
        require(_donationCurrency.lendingAddress != address(0), "price-feed/invalid-lending");
        require(_donationCurrency.underlyingToken != address(0), "price-feed/invalid-underlying");
        require(_donationCurrency.priceFeed != address(0), "price-feed/invalid-price-feed");
        require(!hasDonationCurrency(_donationCurrency.lendingAddress), "price-feed/already-exists");
        _donationCurrencyMapping.add(_donationCurrency.lendingAddress);
        _donationCurrencies[_donationCurrency.lendingAddress] = _donationCurrency;
        _setDirectDonationCurrency(_donationCurrency.underlyingToken, true);
    }

    function updateDonationCurrency(DonationCurrency memory _donationCurrency) public onlyOwner {
        require(_donationCurrency.lendingAddress != address(0), "price-feed/invalid-lending");
        require(_donationCurrency.underlyingToken != address(0), "price-feed/invalid-underlying");
        require(_donationCurrency.priceFeed != address(0), "price-feed/invalid-price-feed");
        require(hasDonationCurrency(_donationCurrency.lendingAddress), "price-feed/not-found");
        setDirectDonationCurrency(_donationCurrencies[_donationCurrency.lendingAddress].underlyingToken, false);
        _donationCurrencies[_donationCurrency.lendingAddress] = _donationCurrency;
        setDirectDonationCurrency(_donationCurrency.underlyingToken, true);
    }

    function removeDonationCurrency(address _lendingAddress) public onlyOwner {
        //TODO: !IMPORTANT. Make sure to redeem the intereset corresponding to this donation currency in
        // all the charity pools before the token is removed
        _donationCurrencyMapping.remove(_lendingAddress);
        _setDirectDonationCurrency(_donationCurrencies[_lendingAddress].underlyingToken, false);
        delete _donationCurrencies[_lendingAddress];
    }

    function getDonationCurrency(address _lendingAddress) public view returns (DonationCurrency memory) {
        require(_donationCurrencyMapping.contains(_lendingAddress), "price-feed/currency-not-found");
        return _donationCurrencies[_lendingAddress];
    }

    function hasDonationCurrency(address _lendingAddress) public view returns (bool) {
        return _donationCurrencyMapping.contains(_lendingAddress);
    }

    function setDirectDonationCurrency(address _currencyAddress, bool status) public onlyOwner {
        _setDirectDonationCurrency(_currencyAddress, status);
    }

    function _setDirectDonationCurrency(address _currencyAddress, bool status) internal {
        allowedDirectDonationCurrencies[_currencyAddress] = status;
    }

    function getAllDonationCurrencies() public view returns (DonationCurrency[] memory) {
        DonationCurrency[] memory result = new DonationCurrency[](_donationCurrencyMapping.length());
        for (uint256 i = 0; i < _donationCurrencyMapping.length(); i++) {
            result[i] = _donationCurrencies[_donationCurrencyMapping.at(i)];
        }
        return result;
    }
}
