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
        (_offset, _limit) = paginationChecks(_iHelp.numberOfCharities, _offset, _limit);

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
        (_offset, _limit) = paginationChecks(_iHelp.numberOfCharities, _offset, _limit);

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
        (_offset, _limit) = paginationChecks(_iHelp.numberOfCharities, _offset, _limit);

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
            result += _iHelp.contributorGeneratedInterest(_account, charity);
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
        (_offset, _limit) = paginationChecks(_iHelp.numberOfCharities, _offset, _limit);

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
        (_offset, _limit) = paginationChecks(_iHelp.numberOfCharities, _offset, _limit);

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
        (_offset, _limit) = paginationChecks(_iHelp.numberOfCharities, _offset, _limit);

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
        (_offset, _limit) = paginationChecks(_iHelp.numberOfCharities, _offset, _limit);
        AnalyticsUtils.GeneralStats memory result;
        result.totalCharities = _limit;
        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            result.totalValueLocked += charity.accountedBalanceUSD();
            result.totalInterestGenerated += charity.totalInterestEarnedUSD();
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
        (_offset, _limit) = paginationChecks(_iHelp.numberOfCharities, _offset, _limit);

        AnalyticsUtils.UserStats memory result;

        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            CharityPoolUtils.DirectDonationsCounter memory registry = charity.donationsRegistry(_user);

            result.totalContributions += charity.balanceOfUSD(_user);
            result.totalDirectDonations += registry.totalContribUSD;
            result.totalDonationsCount += registry.totalDonations;
            result.totalInterestGenerated += _iHelp.contributorGeneratedInterest(_user, address(charity));
        }

        return result;
    }

    /**
     * Return general statistics for a given user
     */
    function walletInfo(
        iHelpToken _iHelp,
        address _user,
        address _xHelpAddress
    ) external view override returns (AnalyticsUtils.WalletInfo memory) {
        AnalyticsUtils.WalletInfo memory result;
        result.iHelpBalance = _iHelp.balanceOf(_user);
        result.xHelpBalance = IERC20(_xHelpAddress).balanceOf(_user);
        result.stakingAllowance = _iHelp.allowance(_user, _xHelpAddress);
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
        (_offset, _limit) = paginationChecks(_iHelp.numberOfCharities, _offset, _limit);

        AnalyticsUtils.IndividualCharityContributionInfo[]
            memory result = new AnalyticsUtils.IndividualCharityContributionInfo[](_limit);

        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            result[index] = AnalyticsUtils.IndividualCharityContributionInfo({
                charityAddress: address(charity),
                charityName: charity.name(),
                totalContributions: charity.accountedBalanceUSD(),
                totalDonations: charity.totalDonationsUSD(),
                totalInterestGenerated: charity.totalInterestEarnedUSD()
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
        (_offset, _limit) = paginationChecks(_iHelp.numberOfCharities, _offset, _limit);

        AnalyticsUtils.UserCharityContributions[] memory result = new AnalyticsUtils.UserCharityContributions[](_limit);

        for (uint256 index = _offset; index < _limit; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            uint256 userDonations = charity.donationsRegistry(_user).totalContribUSD;
            uint256 normalContributions = charity.balanceOfUSD(_user);
            uint256 _yieldGenerated = _iHelp.contributorGeneratedInterest(_user, address(charity));

            result[index] = AnalyticsUtils.UserCharityContributions({
                charityAddress: address(charity),
                charityName: charity.name(),
                totalContributions: normalContributions,
                totalDonations: userDonations,
                yieldGenerated: _yieldGenerated,
                tokenStatistics: getUserTokenContributionsPerCharity(charity, _user)
            });
        }
        return result;
    }

    /**
     * Returns an array that contains the charity contribution info for a given user
     */
    function getUserTokenContributionsPerCharity(CharityPool _charity, address _user)
        public
        view
        returns (AnalyticsUtils.UserCharityTokenContributions[] memory)
    {
        PriceFeedProvider.DonationCurrency[] memory currencies = _charity.getAllDonationCurrencies();

        AnalyticsUtils.UserCharityTokenContributions[]
            memory result = new AnalyticsUtils.UserCharityTokenContributions[](currencies.length);

        for (uint256 index = 0; index < currencies.length; index++) {
            address cTokenAddress = currencies[index].lendingAddress;
            (uint256 price, uint256 decimals) = _charity.getUnderlyingTokenPrice(cTokenAddress);
            uint256 contribution = _charity.balances(_user, cTokenAddress);
            uint256 contributionUSD = (contribution * price) / 10**decimals;
            result[index] = AnalyticsUtils.UserCharityTokenContributions({
                tokenAddress: currencies[index].lendingAddress,
                currency: currencies[index].currency,
                totalContributions: contributionUSD
            });
        }
        return result;
    }

    /**
     * Returns an array that contains the charity donations info for a given user
     */
    function getUserTokenDonationsPerCharity(CharityPool _charity, address _user)
        external
        view
        returns (AnalyticsUtils.UserCharityTokenContributions[] memory)
    {
        PriceFeedProvider.DonationCurrency[] memory currencies = _charity
            .priceFeedProvider()
            .getAllDonationCurrencies();

        AnalyticsUtils.UserCharityTokenContributions[]
            memory result = new AnalyticsUtils.UserCharityTokenContributions[](currencies.length);

        for (uint256 index = 0; index < currencies.length; index++) {
            address cTokenAddress = currencies[index].lendingAddress;
            (uint256 price, uint256 decimals) = _charity.getUnderlyingTokenPrice(cTokenAddress);
            uint256 contribution = _charity.donationBalances(_user, cTokenAddress);
            uint256 contributionUSD = (contribution * price) / 10**decimals;

            result[index] = AnalyticsUtils.UserCharityTokenContributions({
                tokenAddress: currencies[index].lendingAddress,
                currency: currencies[index].currency,
                totalContributions: contributionUSD
            });
        }
        return result;
    }

    /**
     * Returns the user wallet balances of all supported donation currencies
     */
    function getUserWalletBalances(iHelpToken _iHelp, address _user)
        external
        view
        returns (AnalyticsUtils.WalletBalance[] memory)
    {
        PriceFeedProvider.DonationCurrency[] memory currencies = _iHelp.priceFeedProvider().getAllDonationCurrencies();

        AnalyticsUtils.WalletBalance[] memory result = new AnalyticsUtils.WalletBalance[](currencies.length);
        for (uint256 index = 0; index < currencies.length; index++) {
            result[index] = AnalyticsUtils.WalletBalance({
                tokenAddress: currencies[index].underlyingToken,
                currency: currencies[index].currency,
                balance: IERC20(currencies[index].underlyingToken).balanceOf(address(_user))
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
        (_offset, _limit) = paginationChecks(_iHelp.numberOfCharities, _offset, _limit);

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
        return
            AnalyticsUtils.StakingPoolStats({
                iHelpTokensInCirculation: _iHelp.totalCirculating(),
                iHelpStaked: _iHelp.balanceOf(xHelpAddress)
            });
    }

    /**
     * Get user allowance for all donation currencies
     */
    function getDonationCurrencyAllowances(CharityPool _charity, address _user)
        external
        view
        returns (AnalyticsUtils.WalletAllowance[] memory)
    {
        PriceFeedProvider.DonationCurrency[] memory currencies = _charity
            .priceFeedProvider()
            .getAllDonationCurrencies();
        AnalyticsUtils.WalletAllowance[] memory result = new AnalyticsUtils.WalletAllowance[](currencies.length);

        for (uint256 index = 0; index < currencies.length; index++) {
            result[index] = AnalyticsUtils.WalletAllowance({
                tokenAddress: currencies[index].underlyingToken,
                currency: currencies[index].currency,
                allowance: IERC20(currencies[index].underlyingToken).allowance(_user, address(_charity))
            });
        }

        return result;
    }

    /**
     * Get all the configured donation currencies
     */
    function getSupportedCurrencies(iHelpToken _iHelp)
        public
        view
        returns (AnalyticsUtils.DonationCurrencyDetails[] memory)
    {
        PriceFeedProvider.DonationCurrency[] memory currencies = _iHelp.priceFeedProvider().getAllDonationCurrencies();
        AnalyticsUtils.DonationCurrencyDetails[] memory result = new AnalyticsUtils.DonationCurrencyDetails[](
            currencies.length
        );

        for (uint256 i = 0; i < currencies.length; i++) {
            uint256 decimals = IERC20(currencies[i].underlyingToken).decimals();
            (uint256 price, uint256 priceDecimals) = _iHelp.priceFeedProvider().getUnderlyingTokenPrice(
                currencies[i].lendingAddress
            );

            result[i].decimals = decimals;
            result[i].provider = currencies[i].provider;
            result[i].currency = currencies[i].currency;
            result[i].underlyingToken = currencies[i].underlyingToken;
            result[i].lendingAddress = currencies[i].lendingAddress;
            result[i].priceFeed = currencies[i].priceFeed;
            result[i].price = price;
            result[i].priceDecimals = priceDecimals;
        }

        return result;
    }

    /**
     * Returns an array that contains the charity contributors
     */
    function getContributorsPerCharity(
        CharityPool _charity,
        uint256 _offset,
        uint256 _limit
    ) public view returns (AnalyticsUtils.CharityContributor[] memory) {
        (_offset, _limit) = paginationChecks(_charity.numberOfContributors, _offset, _limit);

        require(address(_charity.ihelpToken()) != address(0), "not-found/iHelp");
        AnalyticsUtils.CharityContributor[]
            memory result = new AnalyticsUtils.CharityContributor[](_limit);

        for (uint256 index = _offset; index < _limit; index++) {
            address _user = _charity.contributorAt(index);
            CharityPoolUtils.DirectDonationsCounter memory registry = _charity.donationsRegistry(_user);
            result[index].contributorAddress = _user;
            result[index].totalContributions += _charity.balanceOfUSD(_user);
            result[index].totalDonations += registry.totalContribUSD;
            result[index].totalDonationsCount += registry.totalDonations;
            result[index].totalInterestGenerated += _charity.ihelpToken().contributorGeneratedInterest(_user, address(_charity));
        }
        return result;
    }

    function paginationChecks(
        function () view external returns (uint256) arrLenFn,
        uint256 _offset,
        uint256 _limit
    ) internal view returns (uint256, uint256) {
        uint256 length = arrLenFn();
        require(_offset < length, "Offset to large");

        if (_limit == 0) {
            _limit = length;
        }

        if (_offset + _limit >= length) {
            _limit = length - _offset;
        }

        return (_offset, _limit);
    }
}
