// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./CharityPool.sol";
import "./CharityPoolUtils.sol";

contract CharityPoolCloneFactory {
    address immutable charityPoolImplementation;

    constructor() {
        charityPoolImplementation = address(new CharityPool());
    }

    function createCharityPool(CharityPoolUtils.CharityPoolConfiguration memory configuration)
        external
        returns (address)
    {
        address clone = Clones.clone(charityPoolImplementation);
        CharityPool(payable(clone)).initialize(configuration);
        return clone;
    }
}
