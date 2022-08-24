// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./iHelpTokenInterface.sol";

import "hardhat/console.sol";

contract xHelpToken is ERC20CappedUpgradeable, OwnableUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    uint256 internal __rewardAwarded;

    uint256 public rewardPerTokenStored;
    uint256 public totalClaimed;

    EnumerableSet.AddressSet private stakeholders;

    mapping(address => uint256) internal claimableStakeholderReward;
    mapping(address => uint256) public claimed;
    mapping(address => uint256) public userRewardPerTokenPaid;

    iHelpTokenInterface public ihelpToken;

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        claimableStakeholderReward[account] = claimableRewardOf(account);

        userRewardPerTokenPaid[account] = rewardPerTokenStored;
        _;
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        address _token
    ) public initializer {
        require(address(_token) != address(0), "token is not defined");

        __ERC20_init(_name, _symbol);
        __ERC20Capped_init_unchained(20000000 * 1000000000000000000);
        __Ownable_init();

        ihelpToken = iHelpTokenInterface(_token);
    }

    function rewardPerToken() public view returns (uint256) {
        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            return 0;
        }
        return rewardPerTokenStored;
    }

    function deposit(uint256 _pie) external updateReward(msg.sender) {
        require(_pie != 0, "Funding/deposit-zero");
        require(ihelpToken.transferFrom(msg.sender, address(this), _pie), "could not transfer tokens");

        _mint(msg.sender, _pie);
        stakeholders.add(msg.sender);
    }

    function withdraw(uint256 requestedAmount) external updateReward(msg.sender) {
        require(requestedAmount != 0, "Funding/withdraw-zero");

        _burn(msg.sender, requestedAmount);

        if (balanceOf(msg.sender) == 0) {
            stakeholders.remove(msg.sender);
        }

        require(ihelpToken.transfer(msg.sender, requestedAmount), "could not transfer tokens");
    }

    function balance() public view returns (uint256) {
        return balanceOf(msg.sender);
    }

    function claimableReward() public view returns (uint256) {
        return claimableRewardOf(msg.sender);
    }

    function claimableRewardOf(address _addr) public view returns (uint256) {
        uint256 _balance = balanceOf(_addr);
        if (_balance == 0) {
            return claimableStakeholderReward[_addr];
        }

        return
            claimableStakeholderReward[_addr] + (_balance * (rewardPerToken() - userRewardPerTokenPaid[_addr])) / 1e9;
    }

    function totalAwarded() public view returns (uint256) {
        return __rewardAwarded;
    }

    function rewardToken() public view returns (IERC20) {
        return ihelpToken.getUnderlyingToken();
    }

    function stakingPool() public view returns (address) {
        return ihelpToken.stakingPool();
    }

    function totalToReward() public view returns (uint256) {
        uint256 leftToClaim =  __rewardAwarded - totalClaimed;
        return rewardToken().balanceOf(address(this)) - leftToClaim;
    }

    function getStakeholders() public view returns (address[] memory) {
        return stakeholders.values();
    }

    function distributeRewards() public onlyOwner {
        console.log("distributing rewards for stakers...");

        uint256 totalStaked = totalSupply();
        console.log("totalStaked", totalStaked);

        uint256 totalReward = totalToReward();
        console.log("totalReward", totalReward);

        if (totalStaked > 0) {
            rewardPerTokenStored += (totalReward * 1e9) / totalStaked;
            __rewardAwarded += totalReward;
        } else {
            rewardPerTokenStored = 0;
            rewardToken().transfer(msg.sender, totalReward);
        }

        console.log("rewardPerTokenStored", rewardPerTokenStored);
    }
 
    function claimReward() public updateReward(msg.sender) {
        uint256 claimAmount = claimableRewardOf(msg.sender);
       _claim(claimAmount, msg.sender);
    }

    function claimSpecificReward(uint256 amount) public updateReward(msg.sender) {
       _claim(amount, msg.sender);
    }

    function _claim(uint256 amount, address account) internal {
        uint256 claimAmount = claimableRewardOf(msg.sender);
        require(claimAmount >= amount, "not enough claimable balance for amount");

        console.log("claiming reward", msg.sender, amount);

        claimableStakeholderReward[msg.sender] -= amount;
        claimed[account] += amount;
        totalClaimed += amount;
        rewardToken().transfer(msg.sender, amount);
    }
}
