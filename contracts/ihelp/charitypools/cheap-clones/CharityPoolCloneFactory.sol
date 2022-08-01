// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "../CharityPool.sol";
import "../CharityPoolUtils.sol";

contract CharityPoolCloneFactory {
    address immutable charityPoolImplementation;

    struct DeployedCharity {
        string name;
        address addr;
    }
    event Created(DeployedCharity[] newCharities);

    constructor(address _charityImplementation) {
        charityPoolImplementation = _charityImplementation;
    }

    function createCharityPool(CharityPoolUtils.CharityPoolConfiguration[] memory configurations) external {
        DeployedCharity[] memory result = new DeployedCharity[](configurations.length);
        for (uint256 i = 0; i < configurations.length; i++) {
            address clone = Clones.clone(charityPoolImplementation);
            CharityPool(payable(clone)).initialize(configurations[i]);
            result[i] = DeployedCharity({addr: clone, name: configurations[i].charityName});
        }
        emit Created(result);
    }
}
