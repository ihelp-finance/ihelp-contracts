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
    mapping(address => mapping(address => uint256)) public claimed;
    mapping(address => mapping(address => uint256)) public charityRewardPerTokenPaid;

     // Get total deposited lenderTokens
    function deposited(address _lenderTokenAddress) public virtual view returns(uint256);  

    // Handle unclamied rewards transfer
    function sweepRewards(address _lenderTokenAddress, uint256 _amount) virtual internal;

    // Handle rewards transfer to their respective charity
    function transferReward(address _charityAddress, address _lenderTokenAddress, uint256 _amount) virtual internal;

    // Returns the newly generated charity rewards
    function currentRewards(address _lenderTokenAddress) public virtual returns(uint256);


    // Keeps track of rewards to be distributed to the charities
    modifier updateReward(address _charityAddress, address _lenderTokenAddress) {
        rewardPerTokenStored[_lenderTokenAddress] = rewardPerToken(_lenderTokenAddress);
        claimableCharityReward[_charityAddress][_lenderTokenAddress] = claimableCharityReward[_charityAddress][_lenderTokenAddress];

        charityRewardPerTokenPaid[_charityAddress][_lenderTokenAddress] = rewardPerTokenStored[_lenderTokenAddress];
        _;
    }

    // Returns the reward ratio for a given lender token
    function rewardPerToken(address _lenderAddress) public view returns (uint256) {
        if (deposited(_lenderAddress) == 0) {
            return 0;
        }
        return rewardPerTokenStored[_lenderAddress];
    }

      function claimReward(address _charityAddress, address _lenderTokenAddress) public updateReward(_charityAddress, _lenderTokenAddress) {
        uint256 claimAmount = claimableCharityReward[_charityAddress][_lenderTokenAddress];
       _claim(claimAmount, _charityAddress, _lenderTokenAddress);
    }


    function _claim(uint256 amount, address _charityAddress, address _lenderTokenAddress) internal {
        uint256 claimAmount = claimableCharityReward[_charityAddress][_lenderTokenAddress];
        require(claimAmount >= amount, "not enough claimable balance for amount");


        claimableCharityReward[_charityAddress][_lenderTokenAddress] -= amount;
        claimed[_charityAddress][_lenderTokenAddress] += amount;
        totalClaimed[_lenderTokenAddress] += amount;

        transferReward(_charityAddress, _lenderTokenAddress, amount);
    }

    // Calculates the new reward ratio after new rewards are added to the pool
    function distributeRewards(address _lenderTokenAddress) internal {
        uint256 totalDeposited = deposited(_lenderTokenAddress);
        uint256 totalReward = totalCharityReward(_lenderTokenAddress);

        if (totalDeposited > 0) {
            rewardPerTokenStored[_lenderTokenAddress] += (totalReward * 1e9) / totalDeposited;
            rewardAwarded[_lenderTokenAddress] += totalReward;
        } else {
            rewardPerTokenStored[_lenderTokenAddress] = 0;
            sweepRewards(_lenderTokenAddress, totalReward);
        }
    }

    // Returns the newly generated charity rewards
    function totalCharityReward(address _lenderTokenAddress) internal virtual returns (uint256) {
        uint256 leftToClaim = rewardAwarded[_lenderTokenAddress] - totalClaimed[_lenderTokenAddress];
        return currentRewards(_lenderTokenAddress) - leftToClaim;
    }
}
