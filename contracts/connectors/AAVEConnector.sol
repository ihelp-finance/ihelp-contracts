// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {AToken} from "@aave/core-v3/contracts/protocol/tokenization/AToken.sol";
import "hardhat/console.sol";

import "./ConnectorInterface.sol";

contract AAVEConnector is ConnectorInterface, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    uint256 public blockTime = 4000;

    function initialize() public initializer {
        __Ownable_init();
    }

    function mint(address aToken, uint256 mintAmount) external override returns (uint256) {
        IERC20(_underlying(aToken)).safeTransferFrom(msg.sender, address(this), mintAmount);
        return _mint(aToken, mintAmount);
    }

    function _mint(address aToken, uint256 mintAmount) internal virtual returns (uint256) {
        IPool pool = AToken(aToken).POOL();
        IERC20(_underlying(aToken)).safeIncreaseAllowance(address(pool), mintAmount);

        pool.supply(_underlying(aToken), mintAmount, msg.sender, 0);
        return 0;
    }

    function redeemUnderlying(address aToken, uint256 redeemAmount) external override returns (uint256) {
        IERC20(aToken).transferFrom(msg.sender, address(this), redeemAmount);
        return _redeemUnderlying(aToken, redeemAmount);
    }

    function _redeemUnderlying(address aToken, uint256 redeemAmount) internal virtual returns (uint256) {
        IPool pool = AToken(aToken).POOL();
        IERC20(aToken).safeIncreaseAllowance(address(pool), redeemAmount);
        pool.withdraw(_underlying(aToken), redeemAmount, msg.sender);
        return 0;
    }

    function cTokenValueOfUnderlying(address, uint256 amount) external pure returns (uint256) {
        return amount;
    }

    function accrueAndGetBalance(address aToken, address owner) external view returns (uint256) {
        return AToken(aToken).balanceOf(owner);
    }

    function supplyRatePerBlock(address aToken) external view override returns (uint256) {
        uint256 apr = supplyAPR(aToken, 0);
        return (( apr / 365 / 24 / 60 / 60) * blockTime) / 1000;
    }

    function supplyAPR(address aToken, uint256) public view override returns (uint256) {
        IPool pool = AToken(aToken).POOL();
        DataTypes.ReserveData memory data = pool.getReserveData(_underlying(aToken));
        return uint256(data.currentLiquidityRate) / 1e9;
    }

    function totalSupply(address aToken) external view override returns (uint256) {
        return AToken(aToken).totalSupply();
    }

    function balanceOf(address aToken, address user) external view override returns (uint256) {
        return AToken(aToken).balanceOf(user);
    }

    function underlying(address _aToken) external view override returns (address) {
        return _underlying(_aToken);
    }

    function _underlying(address aToken) internal view returns (address) {
        return AToken(aToken).UNDERLYING_ASSET_ADDRESS();
    }

    function lender() external pure returns (string memory) {
        return "aave";
    }

    /**
     * Sets blocktime
     */
    function setBlockTime(uint256 _blockTimeInMilli) external onlyOwner {
        require(_blockTimeInMilli > 0, "invalid/cannot-be-0");
        blockTime = _blockTimeInMilli;
    }
}
