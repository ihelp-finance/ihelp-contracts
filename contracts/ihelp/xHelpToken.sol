// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

import "../utils/ERC20Upgradeable.sol";
import "../utils/ERC20Mintable.sol";
import "../utils/SafeDecimalMath.sol";

import "./iHelpTokenInterface.sol";

import "hardhat/console.sol";

contract xHelpToken is ERC20Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
  
  iHelpTokenInterface public ihelpToken;
  
  bool private initialized;
  
  using SafeMath for uint256;
  
  uint256 internal __rewardAwarded;
  address[] public stakeholders;
  mapping(address => uint256) internal claimableStakeholderReward;

  function initialize (
    string memory _name,
    string memory _symbol,
    address _token
  ) public {
    require(address(_token) != address(0), "token is not defined");
    
    require(!initialized, "Contract instance has already been initialized");
    initialized = true;

    __Ownable_init();
    __ReentrancyGuard_init();
    
    __ERC20_init(_name, _symbol);
    ihelpToken = iHelpTokenInterface(_token);
  }

  function deposit(uint256 _pie) external returns (uint256) {
    
      require(_pie != 0, "Funding/deposit-zero");
      
      // only push a new stakeholder if not already present
      bool found = false;
      for (uint i = 0; i < stakeholders.length; i++) {
          if (stakeholders[i] == msg.sender) {
              found = true;
              break;
          }
      }
      if (!found) {
          stakeholders.push(msg.sender);
      }
    
      _mint(msg.sender, _pie);
      
      require(ihelpToken.transferFrom(msg.sender, address(this), _pie), "could not transfer tokens");
      
  }
  
  function withdraw(uint256 requestedAmount) external returns (uint) {
    
    require(requestedAmount != 0, "Funding/withdraw-zero");
    
    _burn(msg.sender, requestedAmount);
    
    if ( balanceOf(msg.sender) == 0 ) {
      removeStakeholderByAddress(msg.sender);
    }
    
    require(ihelpToken.transfer(msg.sender, requestedAmount), "could not transfer tokens");
    
  }
  
  function find(address _addr) internal returns(uint) {
      uint i = 0;
      while (stakeholders[i] != _addr) {
          if (i<stakeholders.length-1){ 
              i++;
          } else {
              i=stakeholders.length;
              break;
          }
      }
      return i;
  }

  function removeByIndex(uint i) internal {
      while (i<stakeholders.length-1) {
          stakeholders[i] = stakeholders[i+1];
          i++;
      }
      stakeholders.pop();
  }
  
  function removeStakeholderByAddress(address _addr) internal {
      uint i = find(_addr);
      if (i < stakeholders.length) {
          removeByIndex(i);
      }
  }
  
  function balance() public view returns(uint256) {
    return balanceOf(msg.sender);
  }
  
  function claimableReward() public view returns (uint256) {
    return claimableStakeholderReward[msg.sender];
  }
  
  function claimableRewardOf(address _addr) public view returns (uint256) {
    return claimableStakeholderReward[_addr];
  }
  
  function totalAwarded() public view returns (uint256) {
    return __rewardAwarded;
  }
  
  function rewardToken() public view returns (IERC20) {
    return ihelpToken.getUnderlyingToken();
  }
  
  function stakingPool() public view returns (address) {
    return ihelpToken.getStakingPool();
  }
  
  function holdingPool() public view returns (address) {
    return ihelpToken.getHoldingPool();
  }
  
  function totalToReward() public view returns (uint256) {
    return rewardToken().balanceOf(stakingPool());
  }
  
  function getStakeholders() public view returns (address[] memory) {
    return stakeholders;
  }
  
  function distributeRewards() public onlyOwner {
    
    console.log('distributing rewards for stakers...');
    
    uint256 totalStaked = totalSupply();
    console.log('totalStaked',totalStaked);
    
    uint256 totalReward = totalToReward();
    console.log('totalReward',totalReward);
  
    if (totalReward > 0) {
      
      for (uint i = 0; i < stakeholders.length; i++) {
        
        address stakeholder = stakeholders[i];
        console.log('stakeholder',stakeholder);
        
        uint256 helpStaked = balanceOf(stakeholder);
        console.log('helpStaked',helpStaked);
      
        uint256 rewardShare = SafeDecimalMath.divideDecimal(helpStaked, totalStaked);
        console.log('rewardShare', rewardShare);
        
        uint256 reward = SafeDecimalMath.multiplyDecimal(rewardShare, totalReward);
        console.log('reward', reward);
        
        claimableStakeholderReward[stakeholder] += reward;
      
      }
      
      __rewardAwarded += totalReward;
      
      // transfer this reward to the holding pool
      rewardToken().approve(address(this), totalReward);
      rewardToken().transferFrom(stakingPool(), address(this), totalReward);
    
    }
    
  }
  
  function claimReward() public {

      uint256 claimAmount = claimableStakeholderReward[msg.sender];

      console.log('claiming reward', msg.sender, claimAmount);

      claimableStakeholderReward[msg.sender] -= claimAmount;

      rewardToken().approve(msg.sender, claimAmount);
      rewardToken().transferFrom(address(this), msg.sender, claimAmount);

  }
  
  function claimSpecificReward(uint256 amount) public {

      uint256 claimAmount = claimableStakeholderReward[msg.sender];
      
      require(claimAmount >= amount,'not enough claimable balance for amount');

      console.log('claiming reward', msg.sender, amount);

      claimableStakeholderReward[msg.sender] -= amount;

      rewardToken().approve(msg.sender, amount);
      rewardToken().transferFrom(address(this), msg.sender, amount);

  }
  
}
