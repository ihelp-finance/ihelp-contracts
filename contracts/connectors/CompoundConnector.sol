// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {AToken} from "@aave/core-v3/contracts/protocol/tokenization/AToken.sol";

import "./ConnectorInterface.sol";
import "../utils/ICErc20.sol";

contract CompoundConnector is ConnectorInterface, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    function initialize() public initializer {
        __Ownable_init();
    }

    function mint(address cToken, uint256 mintAmount) external override returns (uint256) {
        IERC20(_underlying(cToken)).safeTransferFrom(msg.sender, address(this), mintAmount);
        IERC20(_underlying(cToken)).safeIncreaseAllowance(address(cToken), mintAmount);
        uint256 result = ICErc20(cToken).mint(mintAmount);
        IERC20(cToken).safeTransfer(msg.sender, IERC20(cToken).balanceOf(address(this)));
        return result;
    }

    function redeemUnderlying(address cToken, uint256 redeemAmount) external override returns (uint256) {
        uint256 cTokens = ICErc20(cToken).cTokenValueOf(redeemAmount);
        IERC20(cToken).safeTransferFrom(msg.sender, address(this), cTokens);
        IERC20(cToken).safeIncreaseAllowance(address(cToken), redeemAmount);
        uint256 result = ICErc20(cToken).redeemUnderlying(redeemAmount);
        IERC20(_underlying(cToken)).safeTransfer(msg.sender, IERC20(_underlying(cToken)).balanceOf(address(this)));
        IERC20(cToken).safeTransfer(msg.sender, IERC20(cToken).balanceOf(address(this)));
        return result;
    }

    function cTokenValueOfUnderlying(address cToken, uint256 amount) external view returns (uint256) {
        return ICErc20(cToken).cTokenValueOf(amount);
    }

    function accrueAndGetBalance(address cToken, address owner) external returns (uint256) {
        return ICErc20(cToken).balanceOfUnderlying(owner);
    }

    function supplyRatePerBlock(address cToken) external view override returns (uint256) {
        return ICErc20(cToken).supplyRatePerBlock();
    }

    function totalSupply(address cToken) external view override returns (uint256) {
        return ICErc20(cToken).totalSupply();
    }

    function balanceOf(address cToken, address user) external view override returns (uint256) {
        return ICErc20(cToken).balanceOf(user);
    }

    function underlying(address cToken) external view override returns (address) {
        return _underlying(cToken);
    }

    function _underlying(address cToken) internal view returns (address) {
        return ICErc20(cToken).underlying();
    }

    function lender() external pure returns (string memory) {
        return "compound";
    }
}