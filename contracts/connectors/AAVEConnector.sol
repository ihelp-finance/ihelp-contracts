// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {AToken} from "@aave/core-v3/contracts/protocol/tokenization/AToken.sol";

import "./ConnectorInterface.sol";

contract AAVEConnector is ConnectorInterface, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    function initialize(address _lendingTokenAddress) public initializer {
        __Ownable_init();
    }

    function mint(address aToken, uint256 mintAmount) external override returns (uint256) {
        IERC20(UNDERLYING(aToken)).safeTransferFrom(msg.sender, address(this), mintAmount);
        IPool pool = AToken(aToken).POOL();
        IERC20(UNDERLYING(aToken)).safeIncreaseAllowance(address(pool), mintAmount);
        pool.supply(UNDERLYING(aToken), mintAmount, msg.sender, 0);
        return 0;
    }

    function redeemUnderlying(address aToken, uint256 redeemAmount) external override returns (uint256) {
        IERC20(aToken).safeTransferFrom(msg.sender, address(this), redeemAmount);
        IPool pool = AToken(aToken).POOL();
        IERC20(aToken).safeIncreaseAllowance(address(pool), redeemAmount);
        pool.withdraw(UNDERLYING(aToken), redeemAmount, msg.sender);
        return 0;
    }

    function balanceOfUnderlying(address aToken, address owner) external view override returns (uint256) {
        return AToken(aToken).scaledBalanceOf(owner);
    }

    function supplyRatePerBlock(address aToken) external view override returns (uint256) {
        IPool pool = AToken(aToken).POOL();
        DataTypes.ReserveData memory data = pool.getReserveData(UNDERLYING(aToken));
        return uint256(data.currentLiquidityRate);
    }

    function totalSupply(address aToken) external view override returns (uint256) {
        return AToken(aToken).totalSupply();
    }

    function balanceOf(address aToken, address user) external view override returns (uint256) {
        return AToken(aToken).balanceOf(user);
    }

    function underlying(address aToken) external view override returns (address) {
        return UNDERLYING(aToken);
    }

    function UNDERLYING(address aToken) internal view returns (address) {
        return AToken(aToken).UNDERLYING_ASSET_ADDRESS();
    }

    function lender() external view returns (string memory) {
        return "aave";
    }
}
