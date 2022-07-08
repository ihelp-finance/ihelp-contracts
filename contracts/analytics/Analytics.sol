// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.9;

import "../ihelp/charitypools/CharityPool.sol";
import "../ihelp/iHelpToken.sol";
import "../ihelp/PriceFeedProvider.sol";
import "../ihelp/charitypools/CharityPoolUtils.sol";
import "./AnalyticsUtils.sol";
import "./IAnalytics.sol";
import "../utils/IERC20.sol";

/**
 * @title Analytics
 */
contract Analytics is IAnalytics {
    /**
     * Calaculates the generated interest for a given charity
     */
    function generatedInterest(CharityPool _charityPool) external view override returns (uint256) {
        return _charityPool.calculateTotalInterestEarned();
    }

    /**
     * Calaculates the total generated interest for all charities
     */
    function totalGeneratedInterest(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view override returns (uint256) {
        (_offset, _limit) = paginationChecks(_iHelp, _offset, _limit);

        uint256 result;
        for (uint256 index = _offset; index < _limit; index++) {
            result += CharityPool(payable(_iHelp.charityAt(index))).calculateTotalInterestEarned();
        }
        return result;
    }

    /**
     * Calaculates the total generated interest for a given yield protocol
     */
    function getYieldProtocolGeneratedInterest(
        iHelpToken _iHelp,
        address _cTokenAddress,
        uint256 _offset,
        uint256 _limit
    ) external view override returns (uint256) {
        (_offset, _limit) = paginationChecks(_iHelp, _offset, _limit);

        uint256 result;
        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            result += charity.totalInterestEarned(_cTokenAddress);
        }
        return result;
    }

    /**
     * Calaculates the total generated yield for a given charity
     */
    function getYieldProtocolGeneratedInterestByCharity(CharityPool _charity) external view override returns (uint256) {
        return _charity.totalInterestEarnedUSD();
    }

    /**
     * Calaculates the total generated interest for a given underlying currency
     */
    function getUnderlyingCurrencyGeneratedInterest(
        iHelpToken _iHelp,
        address _underlyingCurrency,
        uint256 _offset,
        uint256 _limit
    ) external view override returns (uint256) {
        (_offset, _limit) = paginationChecks(_iHelp, _offset, _limit);

        uint256 result;
        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));

            PriceFeedProvider.DonationCurrency[] memory cTokens = _iHelp.priceFeedProvider().getAllDonationCurrencies();
            for (uint256 index2 = 0; index2 < cTokens.length; index2++) {
                if (cTokens[index2].underlyingToken == _underlyingCurrency) {
                    result += charity.totalInterestEarned(cTokens[index2].lendingAddress);
                }
            }
        }
        return result;
    }

    /**
     * Calaculates generated interest for a given user
     */
    function getUserGeneratedInterest(
        iHelpToken _iHelp,
        address _account,
        uint256 _offset,
        uint256 _limit
    ) external view override returns (uint256) {
        uint256 charities = _iHelp.numberOfCharities();

        require(_offset < charities, "Offset to large");

        if (_limit == 0) {
            _limit = charities;
        }

        if (_offset + _limit >= charities) {
            _limit = charities - _offset;
        }

        uint256 result;
        for (uint256 index = _offset; index < _limit; index++) {
            address charity = _iHelp.charityAt(index);
            result += _iHelp.contirbutorGeneratedInterest(_account, charity);
        }
        return result;
    }

    /**
     * Calaculates the total generated interest for a all users
     */
    function getTotalUserGeneratedInterest(iHelpToken _iHelp) external view override returns (uint256) {
        return _iHelp.totalContributorGeneratedInterest();
    }

    /**
     * Calaculates the total locked value over all charities
     */
    function totalLockedValue(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view override returns (uint256) {
        uint256 charities = _iHelp.numberOfCharities();

        require(_offset < charities, "Offset to large");

        if (_limit == 0) {
            _limit = charities;
        }

        if (_offset + _limit >= charities) {
            _limit = charities - _offset;
        }

        uint256 result;
        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            result += charity.accountedBalanceUSD();
        }
        return result;
    }

    /**
     * Calaculates the total locked value of a charity
     */
    function totalCharityLockedValue(CharityPool _charity) external view override returns (uint256) {
        return _charity.accountedBalanceUSD();
    }

    /**
     * Get total number of helpers
     */
    function totalHelpers(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view override returns (uint256) {
        (_offset, _limit) = paginationChecks(_iHelp, _offset, _limit);

        uint256 result;
        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            result += charity.numberOfContributors();
        }
        return result;
    }

    /**
     * Get number of helpers in a given charity
     */
    function totalHelpersInCharity(CharityPool _charity) external view override returns (uint256) {
        return _charity.numberOfContributors();
    }

    /**
     * Get the total value of direct donations from all charities
     */
    function getTotalDirectDonations(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view override returns (uint256) {
        (_offset, _limit) = paginationChecks(_iHelp, _offset, _limit);

        uint256 result;
        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            result += charity.totalDonationsUSD();
        }
        return result;
    }

    /**
     * Get the total USD value of direct donations for a helper
     */
    function getUserTotalDirectDonations(
        iHelpToken _iHelp,
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view override returns (uint256) {
        (_offset, _limit) = paginationChecks(_iHelp, _offset, _limit);

        uint256 result;
        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            CharityPoolUtils.DirectDonationsCounter memory registry = charity.donationsRegistry(_user);
            result += registry.totalContribUSD;
        }
        return result;
    }

    /**
     * Get the total value of direct donations for a helper
     */
    function getUserDirectDonationsStats(CharityPool _charity, address _user)
        public
        view
        override
        returns (CharityPoolUtils.DirectDonationsCounter memory)
    {
        return _charity.donationsRegistry(_user);
    }

    /**
     * Return general statistics
     */
    function generalStats(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) public view override returns (AnalyticsUtils.GeneralStats memory) {
        (_offset, _limit) = paginationChecks(_iHelp, _offset, _limit);
        AnalyticsUtils.GeneralStats memory result;
        result.totalCharities = _limit;
        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            result.totalValueLocked += charity.accountedBalanceUSD();
            result.totalInterestGenerated += charity.calculateTotalInterestEarned();
            result.totalHelpers += charity.numberOfContributors();
        }
        return result;
    }

    /**
     * Return general statistics for a given charity
     */
    function charityStats(CharityPool _charity) public view override returns (AnalyticsUtils.CharityStats memory) {
        AnalyticsUtils.CharityStats memory result = AnalyticsUtils.CharityStats({
            totalValueLocked: _charity.accountedBalanceUSD(),
            totalYieldGenerated: _charity.totalInterestEarnedUSD(),
            numerOfContributors: _charity.numberOfContributors(),
            totalDirectDonations: _charity.totalDonationsUSD()
        });

        return result;
    }

    /**
     * Return general statistics for a given user
     */
    function userStats(
        iHelpToken _iHelp,
        address _user,
        uint256 _offset,
        uint256 _limit
    ) public view override returns (AnalyticsUtils.UserStats memory) {
        (_offset, _limit) = paginationChecks(_iHelp, _offset, _limit);

        AnalyticsUtils.UserStats memory result;

        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            CharityPoolUtils.DirectDonationsCounter memory registry = charity.donationsRegistry(_user);
            result.totalDirectDonations += registry.totalDonations;
            result.totalContributions += registry.totalContribUSD;
            result.totalInterestGenerated += _iHelp.contirbutorGeneratedInterest(_user, address(charity));
        }

        return result;
    }

    /**
     * Returns an array with all the charity pools and their contributions
     */
    function getCharityPoolsWithContributions(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (AnalyticsUtils.IndividualCharityContributionInfo[] memory) {
        (_offset, _limit) = paginationChecks(_iHelp, _offset, _limit);

        AnalyticsUtils.IndividualCharityContributionInfo[]
            memory result = new AnalyticsUtils.IndividualCharityContributionInfo[](_limit);

        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            result[index] = AnalyticsUtils.IndividualCharityContributionInfo({
                charityAddress: address(charity),
                charityName: charity.name(),
                totalContributions: charity.accountedBalanceUSD(),
                totalDonations: charity.totalDonationsUSD()
            });
        }
        return result;
    }

    /**
     * Returns an array that contains the charity contribution info for a given user
     */
    function getUserContributionsPerCharity(
        iHelpToken _iHelp,
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (AnalyticsUtils.UserCharityContributions[] memory) {
        (_offset, _limit) = paginationChecks(_iHelp, _offset, _limit);

        AnalyticsUtils.UserCharityContributions[] memory result = new AnalyticsUtils.UserCharityContributions[](_limit);

        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            uint256 userDonations = charity.donationsRegistry(_user).totalContribUSD;
            uint256 normalContributions = charity.balanceOfUSD(_user);
            result[index] = AnalyticsUtils.UserCharityContributions({
                charityAddress: address(charity),
                charityName: charity.name(),
                totalContributions: userDonations + normalContributions
            });
        }
        return result;
    }

    /**
     * Get charity pools balances and addresses
     */
    function getCharityPoolsAddressesAndBalances(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (AnalyticsUtils.CharityBalanceInfo[] memory) {
        (_offset, _limit) = paginationChecks(_iHelp, _offset, _limit);

        AnalyticsUtils.CharityBalanceInfo[] memory result = new AnalyticsUtils.CharityBalanceInfo[](_limit);

        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));

            result[index] = AnalyticsUtils.CharityBalanceInfo({
                charityAddress: address(charity),
                charityName: charity.name(),
                balance: IERC20(_iHelp.underlyingToken()).balanceOf(address(charity))
            });
        }

        return result;
    }

    /**
     * Get the state of the staking pool
     */
    function stakingPoolState(iHelpToken _iHelp, address xHelpAddress)
        external
        view
        returns (AnalyticsUtils.StakingPoolStats memory)
    {
        // TODO: Ask matt is this sufficient for getting the iHelp circulation supply or should we consider any oher locked up funds
        uint256 circulationSupply = _iHelp.totalSupply() - _iHelp.balanceOf(xHelpAddress);
        return
            AnalyticsUtils.StakingPoolStats({
                iHelpTokensInCirculation: circulationSupply,
                iHelpStaked: _iHelp.balanceOf(xHelpAddress)
            });
    }

    /**
     * Get all the configured donation currencies
     */
    function getSupportedCurrencies(iHelpToken _iHelp) public view returns (PriceFeedProvider.DonationCurrency[] memory) {
        return _iHelp.priceFeedProvider().getAllDonationCurrencies();
    }

    function paginationChecks(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) internal view returns (uint256, uint256) {
        uint256 charities = _iHelp.numberOfCharities();
        require(_offset < charities, "Offset to large");

        if (_limit == 0) {
            _limit = charities;
        }

        if (_offset + _limit >= charities) {
            _limit = charities - _offset;
        }

        return (_offset, _limit);
    }


}
