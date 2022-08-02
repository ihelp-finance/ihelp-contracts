// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.10;

import "./ConnectorInterface.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {AToken} from "@aave/core-v3/contracts/protocol/tokenization/AToken.sol";

contract AAVEConnector is ConnectorInterface, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    address public LENDING_TOKEN_ADDRESS;

    function initialize(address _lendingTokenAddress) public initializer {
        __Ownable_init();
        LENDING_TOKEN_ADDRESS = _lendingTokenAddress;
    }

    function mint(uint256 mintAmount) external override returns (uint256) {
        IERC20(UNDERLYING()).safeTransferFrom(msg.sender, address(this), mintAmount);
        IPool pool = AToken(LENDING_TOKEN_ADDRESS).POOL();
        IERC20(UNDERLYING()).safeIncreaseAllowance(address(pool), mintAmount);
        pool.supply(UNDERLYING(), mintAmount, msg.sender, 0);
        return 0;
    }

    function redeemUnderlying(uint256 redeemAmount) external override returns (uint256) {
        IPool pool = AToken(LENDING_TOKEN_ADDRESS).POOL();
        pool.withdraw(UNDERLYING(), redeemAmount, msg.sender);
        return 0;
    }

    function balanceOfUnderlying(address owner) external view override returns (uint256) {
        return AToken(LENDING_TOKEN_ADDRESS).scaledBalanceOf(owner);
    }

    function supplyRatePerBlock() external view override returns (uint256) {
        IPool pool = AToken(LENDING_TOKEN_ADDRESS).POOL();
        DataTypes.ReserveData memory data = pool.getReserveData(UNDERLYING());
        return uint256(data.currentLiquidityRate);
    }

    function totalSupply() external view override returns (uint256) {
        return AToken(LENDING_TOKEN_ADDRESS).totalSupply();
    }

    function balanceOf(address user) external view override returns (uint256) {
        return AToken(LENDING_TOKEN_ADDRESS).balanceOf(user);
    }

    function underlying() external view override returns (address) {
        return UNDERLYING();
    }

    function UNDERLYING() internal view returns (address) {
        return AToken(LENDING_TOKEN_ADDRESS).UNDERLYING_ASSET_ADDRESS();
    }
}
