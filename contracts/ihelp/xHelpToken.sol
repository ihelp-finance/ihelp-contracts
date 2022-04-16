// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./iHelpTokenInterface.sol";

import "hardhat/console.sol";

contract xHelpToken is ERC20CappedUpgradeable, OwnableUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;

    iHelpTokenInterface public ihelpToken;

    uint256 public processingState;
    uint256 public __processingGasLimit;

    uint256 internal __rewardAwarded;
    EnumerableSet.AddressSet private stakeholders;

    mapping(address => uint256) public claimed;

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
        __processingGasLimit = 300_000;
    }

    function deposit(uint256 _pie) external {
        require(_pie != 0, "Funding/deposit-zero");

        stakeholders.add(msg.sender);

        _mint(msg.sender, _pie);

        require(ihelpToken.transferFrom(msg.sender, address(this), _pie), "could not transfer tokens");
    }

    function withdraw(uint256 requestedAmount) external {
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
        uint256 totalStaked = totalSupply();
        console.log("totalStaked", totalStaked);

        uint256 totalReward = totalToReward();
        console.log("totalReward", totalReward);
        console.log("stakeholder", _addr);

        uint256 helpStaked = balanceOf(_addr);
        console.log("helpStaked", helpStaked);

        uint256 rewardShare = helpStaked / totalStaked;
        console.log("rewardShare", rewardShare);

        uint256 reward = rewardShare * totalReward;
        console.log("reward", reward);

        uint256 claimedAmount = claimed[_addr];
        console.log("claimed", reward);

        return reward - claimedAmount;
    }

    function totalAwarded() public view returns (uint256) {
        return totalToReward();
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
        return stakeholders.values();
    }

    function claimReward() public {
        uint256 claimAmount = claimableRewardOf(msg.sender);
        console.log("claiming reward", msg.sender, claimAmount);
        rewardToken().transfer(msg.sender, claimAmount);
    }

    function claimSpecificReward(uint256 amount) public {
        uint256 claimAmount = claimableRewardOf(msg.sender);

        require(claimAmount >= amount, "not enough claimable balance for amount");

        console.log("claiming reward", msg.sender, amount);

        claimed[msg.sender] += amount;

        rewardToken().transfer(msg.sender, amount);
    }
}
