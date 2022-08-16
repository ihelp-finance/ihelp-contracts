// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import {PRBMathUD60x18} from "@prb/math/contracts/PRBMathUD60x18.sol";
import "hardhat/console.sol";

contract CTokenMock is ERC20Upgradeable {
    using PRBMathUD60x18 for uint256;

    mapping(address => uint256) internal ownerTokenAmounts;
    ERC20PresetMinterPauser public underlying;

    uint256 internal __supplyRatePerBlock;

    constructor(ERC20PresetMinterPauser _token, uint256 _supplyRatePerBlock) {
        require(address(_token) != address(0), "token is not defined");
        underlying = _token;
        __supplyRatePerBlock = _supplyRatePerBlock;
    }

    function mint(uint256 _pie) external returns (uint256) {
        uint256 exchangeRate = exchangeRateCurrent();
        uint256 newCTokens = _pie.div(exchangeRate);
        _mint(msg.sender, newCTokens);
        require(underlying.transferFrom(msg.sender, address(this), _pie), "could not transfer tokens");
        return 0;
    }

    function getCash() external view returns (uint256) {
        return underlying.balanceOf(address(this));
    }

    function redeemUnderlying(uint256 requestedAmount) external returns (uint256) {
        uint256 cTokens = requestedAmount.div(exchangeRateCurrent());
        _burn(msg.sender, cTokens);
        require(underlying.transfer(msg.sender, requestedAmount), "could not transfer tokens");
        return 0;
    }

    function accrue() external {
        uint256 newTokens = (underlying.balanceOf(address(this)) * 120) / 100;
        underlying.mint(address(this), newTokens);
    }

    function accrueCustom(uint256 amount) external {
        underlying.mint(address(this), amount);
    }

    function balanceOfUnderlying(address account) public view returns (uint256) {
        return balanceOf(account).mul(exchangeRateCurrent());
    }
    
    function exchangeRateStored() public view returns (uint256) {
        // console.log(totalSupply(), underlying.balanceOf(address(this)));
        if (totalSupply() == 0) {
            return 1e18;
        } else {
            return underlying.balanceOf(address(this)).div(totalSupply());
        }
    }

    function exchangeRateCurrent() public view returns (uint256) {
        // console.log(totalSupply(), underlying.balanceOf(address(this)));
        if (totalSupply() == 0) {
            return 1e18;
        } else {
            return underlying.balanceOf(address(this)).div(totalSupply());
        }
    }

    function supplyRatePerBlock() external view returns (uint256) {
        return __supplyRatePerBlock;
    }

    function setSupplyRateMantissa(uint256 _supplyRatePerBlock) external {
        __supplyRatePerBlock = _supplyRatePerBlock;
    }
}
