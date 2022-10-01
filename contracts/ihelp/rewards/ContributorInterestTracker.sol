// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "hardhat/console.sol";

abstract contract ContributorInterestTracker {
    // Rewards stored grouped by lender token
    mapping(address => uint256) public contributorInterestPerTokenStored;

    // Total rewards awarded, by underlying token
    mapping(address => uint256) internal contributorInterestAwarded;

    // We keep track of charity rewards depeding on their deposited amounts
    mapping(address => mapping(address => uint256)) internal contributorGeneratedInterest;
    mapping(address => mapping(address => uint256)) public contributorGeneratedInterestTracked;

    // Get total deposited lenderTokens
    function deposited(address _lenderTokenAddress) public view virtual returns (uint256);

    // Returns contributions for a given contributor under a specific lender token
    function balanceOfContributor(address _contributor, address _lenderTokenAddress) public virtual view returns (uint256);

    // Keeps track of the generated interest
    modifier updateContributorGeneratedInterest(address _lenderTokenAddress, address _contributor) {
        contributorInterestPerTokenStored[_lenderTokenAddress] = contributorInterestGeneratedPerToken(_lenderTokenAddress);
        contributorGeneratedInterest[_lenderTokenAddress][_contributor] = generatedInterestOfContributor(_lenderTokenAddress, _contributor);

        contributorGeneratedInterestTracked[_lenderTokenAddress][_contributor] = contributorInterestPerTokenStored[_lenderTokenAddress];
        _;
    }

    /**
     * Returns the total interest that was generated for a contributor by a given charity
     * @param _lenderTokenAddress - The lenderToken address to lookup
     * @param _contributor - The contributor address to lookup
     * @return The generated interest in the form of the lender token and it's coressponding 
     * holding token value         
     */
    function generatedInterestOfContributor(address _lenderTokenAddress, address _contributor) public view returns (uint256) {
        uint256 _balance = balanceOfContributor(_contributor, _lenderTokenAddress);
        if (_balance == 0) {
            return contributorGeneratedInterest[_lenderTokenAddress][_contributor];
        }

        return contributorGeneratedInterest[_lenderTokenAddress][_contributor] + 
            (_balance * (contributorInterestGeneratedPerToken(_lenderTokenAddress) - contributorGeneratedInterestTracked[_lenderTokenAddress][_contributor])) / 1e9;
    }

    function contributorInterestGeneratedPerToken(address _lenderTokenAddress) public view returns (uint256) {
        if (deposited(_lenderTokenAddress) == 0) {
            return 0;
        }
        return contributorInterestPerTokenStored[_lenderTokenAddress];
    }

    // Calculates the new reward ratio after new rewards are added to the pool
    function trackContributorInterest(address _lenderTokenAddress, uint256 _newInterest) internal  {
        uint256 totalDeposited = deposited(_lenderTokenAddress);
        if (totalDeposited > 0) {
            contributorInterestPerTokenStored[_lenderTokenAddress] += (_newInterest * 1e9) / totalDeposited;
            contributorInterestAwarded[_lenderTokenAddress] += _newInterest;
        } else {
            contributorInterestPerTokenStored[_lenderTokenAddress] = 0;
        }
    }

    uint256[46] private __gap;
}
