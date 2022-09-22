// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

abstract contract ContributorInterestTracker {
    // Rewards stored grouped by lender token
    mapping(address => uint256) public interestPerTokenStored;

    // Total rewards awarded, by underlying token
    mapping(address => uint256) internal interestAwarded;

    // We keep track of charity rewards depeding on their deposited amounts
    mapping(address => mapping(address => uint256)) internal generatedInterest;
    mapping(address => mapping(address => uint256)) public generatedInterestTracked;

    // Get total deposited lenderTokens
    function deposited(address _lenderTokenAddress) public view virtual returns (uint256);

    // Returns contributions for a given contributor under a specific lender token
    function balanceOfContributor(address _contributor, address _lenderTokenAddress) public virtual view returns (uint256);

    // Returns the generated charity rewards
    function totalRewards(address _lenderTokenAddress) public view virtual returns (uint256);

    // Keeps track of the generated interest
    modifier updateGeneratedInterest(address _lenderTokenAddress, address _contributor) {
        interestPerTokenStored[_lenderTokenAddress] = interestGeneratedPerToken(_lenderTokenAddress);
        generatedInterest[_lenderTokenAddress][_contributor] = generatedInterestOf(_lenderTokenAddress, _contributor);

        generatedInterestTracked[_lenderTokenAddress][_contributor] = interestPerTokenStored[_lenderTokenAddress];
        _;
    }

    /**
     * Returns the total interest that was generated for a contributor by a given charity
     * @param _lenderTokenAddress - The lenderToken address to lookup
     * @param _contributor - The contributor address to lookup
     * @return The generated interest in the form of the lender token and it's coressponding 
     * holding token value         
     */
    function generatedInterestOf(address _lenderTokenAddress, address _contributor) public view returns (uint256) {
        uint256 _balance = balanceOfContributor(_contributor, _lenderTokenAddress);
        if (_balance == 0) {
            return generatedInterest[_lenderTokenAddress][_contributor];
        }

        return generatedInterest[_lenderTokenAddress][_contributor] + 
            (_balance * (interestGeneratedPerToken(_lenderTokenAddress) - generatedInterestTracked[_lenderTokenAddress][_contributor])) / 1e9;
    }

    function interestGeneratedPerToken(address _lenderTokenAddress) public view returns (uint256) {
        if (deposited(_lenderTokenAddress) == 0) {
            return 0;
        }
        return interestPerTokenStored[_lenderTokenAddress];
    }

    // Calculates the new reward ratio after new rewards are added to the pool
    function trackInterest(address _lenderTokenAddress, uint256 _newInterest) internal {
        uint256 totalDeposited = deposited(_lenderTokenAddress);
        if (totalDeposited > 0) {
            interestPerTokenStored[_lenderTokenAddress] += (_newInterest * 1e9) / totalDeposited;
            interestAwarded[_lenderTokenAddress] += _newInterest;
        } else {
            interestPerTokenStored[_lenderTokenAddress] = 0;
        }
    }

    uint256[46] private __gap;
}
