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
        uint16
    ) external virtual {
        require(IERC20(asset).transferFrom(msg.sender, address(aToken), amount), "no transfer");
        aToken.mint(msg.sender, onBehalfOf, amount, 1);
    }

    function withdraw(
        address,
        uint256 amount,
        address to
    ) external virtual returns(uint256)  {
        aToken.burn(msg.sender, to, amount, 1);
        return 0;
    }

    // This function is for compatibility sake
    function ADDRESSES_PROVIDER() public pure returns (address) {
        return address(0);
    }

    function setAToken(address _aTokenAddress) public {
        aToken = ATokenMock(_aTokenAddress);
    }

    // This function is for compatibility sake
    function finalizeTransfer(
        address asset,
        address from,
        address to,
        uint256 amount,
        uint256 balanceFromBefore,
        uint256 balanceToBefore
    ) external pure {
        return;
    }

    // This function is for compatibility sake
    function getReserveNormalizedIncome(address asset) external view returns (uint256) {
        return 1;
    }
}
