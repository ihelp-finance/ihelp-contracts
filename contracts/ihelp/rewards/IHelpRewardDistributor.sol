// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

abstract contract IHelpRewardDistributor {
    // Rewards stored
    uint256 public iHelpRewardPerTokenStored;

    // Total rewards claimed
    uint256 public totalIhelpClaimed;

    // We keep track of contributor rewards
    mapping(address => uint256)  internal claimableContributorReward;
    mapping(address => uint256)  internal claimedContributorReward;
    mapping(address => uint256) public iHelpRewardPerTokenPaid;

    // Get total contributions
    function contributions() public view virtual returns (uint256);
    
    // Get total contributions
    function contributionsOf(address _contributor) public view virtual returns (uint256);

    // Keeps track of rewards to be distributed to the charities
    modifier updateIHelpReward(address _contributor) {
        iHelpRewardPerTokenStored = rewardPerToken();
        claimedContributorReward[_contributor] = claimableIHelpRewardOf(_contributor);

        iHelpRewardPerTokenPaid[_contributor] = iHelpRewardPerTokenStored;
        _;
    }

    // Returns the reward ratio 
    function rewardPerToken() public view returns (uint256) {
        if (contributions() == 0) {
            return 0;
        }
        return iHelpRewardPerTokenStored;
    }

    function claimableIHelpRewardOf(address _contributor) public view returns (uint256) {
        uint256 _balance = contributionsOf(_contributor);
        if (_balance == 0) {
            return claimableContributorReward[_contributor];
        }

        return claimableContributorReward[_contributor] + 
            (_balance * (rewardPerToken() - iHelpRewardPerTokenPaid[_contributor])) / 1e9;
    }

    function _claimIHelp(uint256 _amount, address _contributor) internal {
        uint256 claimAmount = claimableIHelpRewardOf(_contributor);
        require(claimAmount >= _amount, "not enough claimable balance for amount");

        claimableContributorReward[_contributor] -= _amount;
    }

    // Calculates the new reward ratio after new rewards are added
    function distributeIHelpRewards(uint256 _newRewards) internal {
        if (contributions() > 0) {
            iHelpRewardPerTokenStored += (_newRewards * 1e9) / contributions();
        } else {
            iHelpRewardPerTokenStored = 0;
        }
    }

    uint256[55] private __gap;
}
