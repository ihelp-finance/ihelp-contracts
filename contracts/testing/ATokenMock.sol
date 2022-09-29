// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@aave/core-v3/contracts/protocol/pool/Pool.sol";
import "@aave/core-v3/contracts/protocol/tokenization/AToken.sol";
import "hardhat/console.sol";

// Ave pool mock
contract ATokenMock is AToken {
    using WadRayMath for uint256;

    constructor(IPool pool) AToken(pool) {}

    function mint(
        address caller,
        address onBehalfOf,
        uint256 amount,
        uint256 index
    ) external virtual override onlyPool returns (bool) {
        // mint
        _userState[onBehalfOf].balance += uint128(amount.rayDiv(1));
        return true;
    }

    function burn(
        address from,
        address receiverOfUnderlying,
        uint256 amount,
        uint256 index
    ) external virtual override onlyPool {
        // burn
        // console.log(" _userState[receiverOfUnderlying].balance",  _userState[receiverOfUnderlying].balance);
        _userState[from].balance -=  uint128(amount.rayDiv(1));
        IERC20(_underlyingAsset).transfer(receiverOfUnderlying, amount);
    }


}
