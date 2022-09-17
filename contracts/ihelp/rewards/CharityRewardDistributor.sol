// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

abstract contract CharityRewardDistributor {
    // Rewards stored grouped by lender token
    mapping(address => uint256) public rewardPerTokenStored;

    // Total rewards claimed, by underlying token
    mapping(address => uint256) public totalClaimed;

    // Total rewards awarded, by underlying token
    mapping(address => uint256) internal rewardAwarded;

    // We keep track of charity rewards depeding on their deposited amounts
    mapping(address => mapping(address => uint256)) internal claimableCharityReward;
    mapping(address => mapping(address => uint256)) public charityRewardPerTokenPaid;

    // Get total deposited lenderTokens
    function deposited(address _lenderTokenAddress) public view virtual returns (uint256);

    // Handle unclamied rewards transfer
    function sweepRewards(address _lenderTokenAddress, uint256 _amount) internal virtual;

    // Returns contributions for a given charity under a specific lender
    function balanceOf(address _charityAddress, address _lenderTokenAddress) public virtual view returns (uint256);

    // Handle rewards transfer to their respective charity
    function transferReward(
        address _charityAddress,
        address _lenderTokenAddress,
        uint256 _amount
    ) internal virtual;

    // Returns the newly generated charity rewards
    function totalRewards(address _lenderTokenAddress) public view virtual returns (uint256);

    // Keeps track of rewards to be distributed to the charities
    modifier updateReward(address _charityAddress, address _lenderTokenAddress) {
        rewardPerTokenStored[_lenderTokenAddress] = rewardPerToken(_lenderTokenAddress);
        claimableCharityReward[_charityAddress][_lenderTokenAddress] = claimableRewardOf(_charityAddress, _lenderTokenAddress);

        charityRewardPerTokenPaid[_charityAddress][_lenderTokenAddress] = rewardPerTokenStored[_lenderTokenAddress];
        _;
    }

    // Returns the reward ratio for a given lender token
    function rewardPerToken(address _lenderTokenAddress) public view returns (uint256) {
        if (deposited(_lenderTokenAddress) == 0) {
            return 0;
        }
        return rewardPerTokenStored[_lenderTokenAddress];
    }

    function claimableRewardOf(address _charityAddress, address _lenderTokenAddress) public view returns (uint256) {
        uint256 _balance = balanceOf(_charityAddress, _lenderTokenAddress);
        if (_balance == 0) {
            return claimableCharityReward[_charityAddress][_lenderTokenAddress];
        }

        return claimableCharityReward[_charityAddress][_lenderTokenAddress] + 
            (_balance * (rewardPerToken(_lenderTokenAddress) - charityRewardPerTokenPaid[_charityAddress][_lenderTokenAddress])) / 1e9;
    }

    function claimReward(address _charityAddress, address _lenderTokenAddress)
        public
        updateReward(_charityAddress, _lenderTokenAddress)
    {
        uint256 claimAmount = claimableRewardOf(_charityAddress, _lenderTokenAddress);
        _claim(claimAmount, _charityAddress, _lenderTokenAddress);
    }

    function _claim(uint256 amount, address _charityAddress, address _lenderTokenAddress) internal {
        uint256 claimAmount = claimableRewardOf(_charityAddress, _lenderTokenAddress);
        require(claimAmount >= amount, "not enough claimable balance for amount");

        claimableCharityReward[_charityAddress][_lenderTokenAddress] -= amount;
        totalClaimed[_lenderTokenAddress] += amount;

        transferReward(_charityAddress, _lenderTokenAddress, amount);
    }

    // Calculates the new reward ratio after new rewards are added to the pool
    function distributeRewards(address _lenderTokenAddress) internal {
        uint256 totalDeposited = deposited(_lenderTokenAddress);
        uint256 newRewards = currentCharityReward(_lenderTokenAddress);

        if (totalDeposited > 0) {
            rewardPerTokenStored[_lenderTokenAddress] += (newRewards * 1e9) / totalDeposited;
            rewardAwarded[_lenderTokenAddress] += newRewards;
        } else {
            rewardPerTokenStored[_lenderTokenAddress] = 0;
            sweepRewards(_lenderTokenAddress, newRewards);
        }
    }

    // Returns the newly generated charity rewards
    function currentCharityReward(address _lenderTokenAddress) internal virtual returns (uint256) {
        uint256 leftToClaim = rewardAwarded[_lenderTokenAddress] - totalClaimed[_lenderTokenAddress];
        return totalRewards(_lenderTokenAddress) - leftToClaim;
    }

    uint256[44] private __gap;
}
