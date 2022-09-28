// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PRBMathUD60x18} from "@prb/math/contracts/PRBMathUD60x18.sol";

import "./ConnectorInterface.sol";
import "../utils/TJErc20.sol";

contract TraderJoeConnector is ConnectorInterface, OwnableUpgradeable {
    using SafeERC20 for IERC20;
    using PRBMathUD60x18 for uint256;

    function initialize() public initializer {
        __Ownable_init();
    }

    function mint(address cToken, uint256 mintAmount) external override returns (uint256) {
        IERC20(_underlying(cToken)).safeTransferFrom(msg.sender, address(this), mintAmount);
        IERC20(_underlying(cToken)).safeIncreaseAllowance(address(cToken), mintAmount);
        uint256 result = TJErc20(cToken).mint(mintAmount);
        IERC20(cToken).safeTransfer(msg.sender, IERC20(cToken).balanceOf(address(this)));
        return result;
    }

    function redeemUnderlying(address cToken, uint256 redeemAmount) external override returns (uint256) {
        uint256 cTokens = cTokenValueOfUnderlying(cToken, redeemAmount);
        IERC20(cToken).safeTransferFrom(msg.sender, address(this), cTokens);
        IERC20(cToken).safeIncreaseAllowance(address(cToken), cTokens);
        uint256 result = TJErc20(cToken).redeemUnderlying(redeemAmount);
        IERC20(_underlying(cToken)).safeTransfer(msg.sender, IERC20(_underlying(cToken)).balanceOf(address(this)));
        IERC20(cToken).safeTransfer(msg.sender, IERC20(cToken).balanceOf(address(this)));
        return result;
    }

    function cTokenValueOfUnderlying(address cToken, uint256 amount) public view returns (uint256) {
        uint256 rate = TJErc20(cToken).exchangeRateStored();
        return amount.div(rate);
    }

    function accrueAndGetBalance(address cToken, address owner) external returns (uint256) {
        return TJErc20(cToken).balanceOfUnderlying(owner);
    }

    function supplyRatePerBlock(address cToken) public view override returns (uint256) {
        uint256 blockTime = 4000;
        return (TJErc20(cToken).supplyRatePerSecond() * blockTime) / 1000;
    }

    function supplyAPR(address cToken, uint256 _blockTime) external view override returns (uint256) {
        uint256 blocksPerDay = (86_400 * 1000) / _blockTime;
        uint256 supplyRatePerDay = supplyRatePerBlock(cToken) * blocksPerDay;
        return supplyRatePerDay * 365;
    }

    function totalSupply(address cToken) external view override returns (uint256) {
        return TJErc20(cToken).totalSupply();
    }

    function balanceOf(address cToken, address user) external view override returns (uint256) {
        return TJErc20(cToken).balanceOf(user);
    }

    function underlying(address cToken) external view override returns (address) {
        return _underlying(cToken);
    }

    function _underlying(address cToken) internal view returns (address) {
        return TJErc20(cToken).underlying();
    }

    function lender() external pure returns (string memory) {
        return "traderjoe";
    }
}
