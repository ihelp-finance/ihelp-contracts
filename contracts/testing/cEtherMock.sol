// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../utils/ERC20Upgradeable.sol";

import "hardhat/console.sol";

contract CEtherMock is ERC20Upgradeable {
  
  uint256 internal __supplyRatePerBlock;
  
  constructor (
    uint256 _supplyRatePerBlock
  ) public {
      __supplyRatePerBlock = _supplyRatePerBlock;
  }
  
  receive () external payable {
        uint256 exchangeRate = exchangeRateCurrent();
      uint256 newCTokens = FixedPoint.calculateMantissa(msg.value, exchangeRate);
      console.log(newCTokens);
      _mint(msg.sender, newCTokens);
    }
  
  fallback () external payable {
        uint256 exchangeRate = exchangeRateCurrent();
      uint256 newCTokens = FixedPoint.calculateMantissa(msg.value, exchangeRate);
      console.log(newCTokens);
      _mint(msg.sender, newCTokens);
    }
    
  function mint() external payable {
      uint256 exchangeRate = exchangeRateCurrent();
      uint256 newCTokens = FixedPoint.calculateMantissa(msg.value, exchangeRate);
      console.log(newCTokens);
      _mint(msg.sender, newCTokens);
  }
  
  function getCash() external view returns (uint) {
    return address(this).balance;
  }

  function redeemUnderlying(uint256 requestedAmount) external returns (uint) {
    uint256 cTokens = cTokenValueOf(requestedAmount);
    _burn(msg.sender, cTokens);
    console.log('requestedAmount',requestedAmount);
    // require(underlying.transfer(msg.sender, requestedAmount), "could not transfer tokens");
    //msg.sender.transfer(requestedAmount);
    console.log('sender1',address(msg.sender));
    console.log('ceth balance',address(this).balance);
    
    //msg.sender.call{value: requestedAmount}("");
    (bool sent, bytes memory data) = msg.sender.call{value:requestedAmount}('');
    require(sent, "Failed to send Ether back to sender");
    
    return 0;

  }

  function accrueCustom() payable external {
    
  }

  function burn(uint256 amount) external {
    _burn(address(this), amount);
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
      return FixedPoint.calculateMantissa(address(this).balance, totalSupply());
    }
  }

  function supplyRatePerBlock() external view returns (uint) {
    return __supplyRatePerBlock;
  }

  function setSupplyRateMantissa(uint256 _supplyRatePerBlock) external {
    __supplyRatePerBlock = _supplyRatePerBlock;
  }
  
}
