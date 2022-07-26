// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../CharityPool.sol";
import "../CharityPoolUtils.sol";

contract CharityBeaconFactory is OwnableUpgradeable {
    uint256 public counter;
    mapping(uint256 => address) private charities;

    UpgradeableBeacon public immutable beacon;

    constructor(address _charityImpl) {
        beacon = new UpgradeableBeacon(_charityImpl);
    }

    function initialize() public initializer  {
        __Ownable_init();
    }

    function createCharityPool(CharityPoolUtils.CharityPoolConfiguration memory configuration)
        external
        returns (address)
    {
        BeaconProxy proxy = new BeaconProxy(
            address(beacon),
            abi.encodeWithSelector(CharityPool(payable(address(0))).initialize.selector, configuration)
        );
        charities[counter++] = address(proxy);
        return address(proxy);
    }

    function getImplementation() public view returns (address) {
        return beacon.implementation();
    }

    function update(address _charityLogic) public onlyOwner {
        beacon.upgradeTo(_charityLogic);
    }

    function getCharityAt(uint256 index) public view returns (address) {
        return charities[index];
    }
}
