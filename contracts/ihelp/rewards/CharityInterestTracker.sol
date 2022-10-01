// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

abstract contract CharityInterestTracker {
    // Rewards stored grouped by lender token
    mapping(address => uint256) public charityInterestPerTokenStored;

    // Total rewards awarded, by underlying token
    mapping(address => uint256) internal charityInterestAwarded;

    // We keep track of charity rewards depeding on their deposited amounts
    mapping(address => mapping(address => uint256)) internal charityGeneratedInterest;
    mapping(address => mapping(address => uint256)) public charityGeneratedInterestTracked;

    // Get total deposited lenderTokens
    function deposited(address _lenderTokenAddress) public view virtual returns (uint256);

    // Returns contributions for a given contributor under a specific lender token
    function balanceOfCharity(address _charity, address _lenderTokenAddress) public virtual view returns (uint256);

    // Keeps track of the generated interest
    modifier updateCharityGeneratedInterest(address _lenderTokenAddress, address _charity) {
        charityInterestPerTokenStored[_lenderTokenAddress] = charityInterestGeneratedPerToken(_lenderTokenAddress);
        charityGeneratedInterest[_lenderTokenAddress][_charity] = generatedInterestOfCharity(_lenderTokenAddress, _charity);

        charityGeneratedInterestTracked[_lenderTokenAddress][_charity] = charityInterestPerTokenStored[_lenderTokenAddress];
        _;
    }

    /**
     * Returns the total interest that was generated for a contributor by a given charity
     * @param _lenderTokenAddress - The lenderToken address to lookup
     * @param _charity - The contributor address to lookup
     * @return The generated interest in the form of the lender token and it's coressponding 
     * holding token value
     */
    function generatedInterestOfCharity(address _lenderTokenAddress, address _charity) public view returns (uint256) {
        uint256 _balance = balanceOfCharity(_charity, _lenderTokenAddress);
        if (_balance == 0) {
            return charityGeneratedInterest[_lenderTokenAddress][_charity];
        }

        return charityGeneratedInterest[_lenderTokenAddress][_charity] + 
            (_balance * (charityInterestGeneratedPerToken(_lenderTokenAddress) - charityGeneratedInterestTracked[_lenderTokenAddress][_charity])) / 1e9;
    }

    function charityInterestGeneratedPerToken(address _lenderTokenAddress) public view returns (uint256) {
        if (deposited(_lenderTokenAddress) == 0) {
            return 0;
        }
        return charityInterestPerTokenStored[_lenderTokenAddress];
    }

    // Calculates the new reward ratio after new rewards are added to the pool
    function trackCharityInterest(address _lenderTokenAddress, uint256 _newInterest) internal  {
        uint256 totalDeposited = deposited(_lenderTokenAddress);
        if (totalDeposited > 0) {
            charityInterestPerTokenStored[_lenderTokenAddress] += (_newInterest * 1e9) / totalDeposited;
            charityInterestAwarded[_lenderTokenAddress] += _newInterest;
        } else {
            charityInterestPerTokenStored[_lenderTokenAddress] = 0;
        }
    }

    uint256[46] private __gap;
}
