// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "./ATokenMock.sol";

// Ave pool mock
contract APoolMock {
    ATokenMock public aToken;

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external virtual {
        require(IERC20(asset).transferFrom(msg.sender, address(aToken), amount), "no transfer");
        aToken.mint(msg.sender, onBehalfOf, amount, 0);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external virtual {
        aToken.burn(msg.sender, to, amount, 0);
    }

    // This function is for compatibility sake
    function ADDRESSES_PROVIDER() public pure returns (address) {
        return address(0);
    }

    function setAToken(address _aTokenAddress) public {
        aToken = ATokenMock(_aTokenAddress);
    }
}
