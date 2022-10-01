// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "../ihelp/ContributionsAggregator.sol";

contract ContributionsAggregatorExtended is ContributionsAggregator {

    function isIHelp(address) internal view virtual override returns (bool) {
        return true;
    }
}
