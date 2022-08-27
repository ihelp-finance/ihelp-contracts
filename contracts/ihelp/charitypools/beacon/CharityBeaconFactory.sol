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

    UpgradeableBeacon public beacon;

    struct DeployedCharity {
        string name;
        address addr;
    }

    event Created(DeployedCharity[] newCharities);

    CharityPoolUtils.CharityPoolConfiguration public defaultCharityConfiguration;

    function initialize(address _charityImpl) public initializer {
        __Ownable_init();
        beacon = new UpgradeableBeacon(_charityImpl);
    }

    function createCharityPool(CharityPoolUtils.CharityPoolConfiguration[] memory configurations) external onlyOwner {
        DeployedCharity[] memory result = new DeployedCharity[](configurations.length);
        for (uint256 i = 0; i < configurations.length; i++) {
            BeaconProxy proxy = new BeaconProxy(
                address(beacon),
                abi.encodeWithSelector(CharityPool(payable(address(0))).initialize.selector, configurations[i])
            );
            charities[counter++] = address(proxy);
            result[i] = DeployedCharity({addr: address(proxy), name: configurations[i].charityName});
        }
        emit Created(result);
    }

    function createCharityPoolFromClient(string memory _charityName) external {
        require(bytes(_charityName).length > 0 , 'params/invalid-length');
        require(defaultCharityConfiguration.operatorAddress != address(0), 'config/not-set');

        CharityPoolUtils.CharityPoolConfiguration memory config = defaultCharityConfiguration;
        config.charityName = _charityName;

        BeaconProxy proxy = new BeaconProxy(
            address(beacon),
            abi.encodeWithSelector(CharityPool(payable(address(0))).initialize.selector, config)
        );

        charities[counter++] = address(proxy);
        DeployedCharity[] memory result = new DeployedCharity[](1);
        result[0] = DeployedCharity({addr: address(proxy), name: config.charityName});
        emit Created(result);
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

    function setDefaultCharityConfiguration(CharityPoolUtils.CharityPoolConfiguration memory _config) external onlyOwner {
        require(_config.operatorAddress != address(0), 'config/operator-not-set');
        require(_config.holdingTokenAddress != address(0), 'config/htoken-not-set');
        require(_config.ihelpAddress != address(0), 'config/ihelp-not-set');
        require(_config.swapperAddress != address(0), 'config/swapper-not-set');
        require(_config.wrappedNativeAddress != address(0), 'config/wrapper-not-set');
        require(_config.priceFeedProvider != address(0), 'config/price-feed-not-set');

        defaultCharityConfiguration = _config;
    }
}
