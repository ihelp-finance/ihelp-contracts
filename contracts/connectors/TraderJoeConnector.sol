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

    uint256 public blockTime = 4000;

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
        uint256 cTokens = redeemAmount.div(TJErc20(cToken).exchangeRateStored());
        IERC20(cToken).safeTransferFrom(msg.sender, address(this), cTokens);
        IERC20(cToken).safeIncreaseAllowance(address(cToken), redeemAmount);
        uint256 result = TJErc20(cToken).redeemUnderlying(redeemAmount);
        IERC20(_underlying(cToken)).safeTransfer(msg.sender, IERC20(_underlying(cToken)).balanceOf(address(this)));
        IERC20(cToken).safeTransfer(msg.sender, IERC20(cToken).balanceOf(address(this)));
        return result;
    }

    function cTokenValueOfUnderlying(address cToken, uint256 amount) external view returns (uint256) {
        return amount.div(TJErc20(cToken).exchangeRateStored());
    }

    function accrueAndGetBalance(address cToken, address owner) external returns (uint256) {
        return TJErc20(cToken).balanceOfUnderlying(owner);
    }

    function supplyRatePerBlock(address cToken) public view override returns (uint256) {
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

    /**
     * Sets blocktime
     */
    function setBlockTime(uint256 _blockTimeInMilli) external onlyOwner {
        require(_blockTimeInMilli > 0, "invalid/cannot-be-0");
        blockTime = _blockTimeInMilli;
    }

    function lender() external pure returns (string memory) {
        return "bankerjoe";
    }
}
