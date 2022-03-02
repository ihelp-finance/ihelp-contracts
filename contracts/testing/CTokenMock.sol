// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../utils/ERC20Upgradeable.sol";
import "../utils/ERC20Mintable.sol";

import "hardhat/console.sol";

contract CTokenMock is ERC20Upgradeable {
  mapping(address => uint256) internal ownerTokenAmounts;
  ERC20Mintable public underlying;

  uint256 internal __supplyRatePerBlock;

  constructor (
    ERC20Mintable _token,
    uint256 _supplyRatePerBlock
  ) public {
    require(address(_token) != address(0), "token is not defined");
    underlying = _token;
    __supplyRatePerBlock = _supplyRatePerBlock;
  }
  
  // function mint(uint256 amount) external returns (uint) {
  //   uint256 newCTokens;
  //   if (totalSupply() == 0) {
  //     newCTokens = amount;
  //   } else {
  //     // they need to hold the same assets as tokens.
  //     // Need to calculate the current exchange rate
  //     uint256 fractionOfCredit = FixedPoint.calculateMantissa(amount, underlying.balanceOf(address(this)));
  //     newCTokens = FixedPoint.multiplyUintByMantissa(totalSupply(), fractionOfCredit);
  //   }
  //   _mint(msg.sender, newCTokens);
  //   require(underlying.transferFrom(msg.sender, address(this), amount), "could not transfer tokens");
  //   return 0;
  // }
  
  function mint(uint256 _pie) external returns (uint256) {
      uint256 exchangeRate = exchangeRateCurrent();
      uint256 newCTokens = FixedPoint.calculateMantissa(_pie, exchangeRate);
      console.log(newCTokens);
      _mint(msg.sender, newCTokens);
      require(underlying.transferFrom(msg.sender, address(this), _pie), "could not transfer tokens");
      return 0;
  }

  function getCash() external view returns (uint) {
    return underlying.balanceOf(address(this));
  }

  function redeemUnderlying(uint256 requestedAmount) external returns (uint) {
    uint256 cTokens = cTokenValueOf(requestedAmount);
    _burn(msg.sender, cTokens);
    require(underlying.transfer(msg.sender, requestedAmount), "could not transfer tokens");
  }

  function accrue() external {
    uint256 newTokens = (underlying.balanceOf(address(this)) * 120) / 100;
    underlying.mint(address(this), newTokens);
  }

  function accrueCustom(uint256 amount) external {
    underlying.mint(address(this), amount);
  }

  function burn(uint256 amount) external {
    underlying.burn(address(this), amount);
  }

  function cTokenValueOf(uint256 tokens) public view returns (uint256) {
    return FixedPoint.divideUintByMantissa(tokens, exchangeRateCurrent());
  }

  function balanceOfUnderlying(address account) public view returns (uint) {
    return FixedPoint.multiplyUintByMantissa(balanceOf(account), exchangeRateCurrent());
  }

  function exchangeRateCurrent() public view returns (uint256) {
    if (totalSupply() == 0) {
      return FixedPoint.SCALE;
    } else {
      return FixedPoint.calculateMantissa(underlying.balanceOf(address(this)), totalSupply());
    }
  }

  function supplyRatePerBlock() external view returns (uint) {
    return __supplyRatePerBlock;
  }

  function setSupplyRateMantissa(uint256 _supplyRatePerBlock) external {
    __supplyRatePerBlock = _supplyRatePerBlock;
  }
}
