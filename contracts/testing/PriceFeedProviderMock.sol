// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../ihelp/PriceFeedProvider.sol";

contract PriceFeedProviderMock is PriceFeedProvider {
    /**
     * Returns the underlying token price and price decimals
     */
    function getUnderlyingTokenPrice(address) public pure override returns (uint256, uint256) {
       return (1e9, 9);
    }
}