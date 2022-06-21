// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.9;

import "../ihelp/charitypools/CharityPool.sol";
import "../ihelp/iHelpToken.sol";
import "../ihelp/charitypools/CharityPoolUtils.sol";

/**
 * @title Analytics
 */
contract Analytics {
    /**
     * Calaculates the generated interest for a given charity
     */
    function generatedInterest(CharityPool _charityPool) external view returns (uint256) {
        return _charityPool.calculateTotalInterestEarned();
    }

    /**
     * Calaculates the total generated interest for all charities
     */
    function totalGeneratedInterest(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256) {
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
            result += CharityPool(payable(_iHelp.charityAt(index))).calculateTotalInterestEarned();
        }
        return result;
    }

    /**
     * Calaculates the total generated interest for a given yiled protocol
     */
    function getYieldProtocolGeneratedInterest(
        iHelpToken _iHelp,
        address _cTokenAddress,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256) {
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
            result += charity.totalInterestEarned(_cTokenAddress);
        }
        return result;
    }

    /**
     * Calaculates the total generated interest for a given yiled protocol
     */
    function getYieldProtocolGeneratedInterestByCharity(CharityPool _charity) external view returns (uint256) {
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
    ) external view returns (uint256) {
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

            address[] memory cTokens = charity.getCTokens();

            for (uint256 index2 = 0; index2 < cTokens.length; index2++) {
                if (address(charity.getUnderlying(cTokens[index2])) == _underlyingCurrency) {
                    result += charity.totalInterestEarned(cTokens[index2]);
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
    ) external view returns (uint256) {
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
    function getTotalUserGeneratedInterest(iHelpToken _iHelp) external view returns (uint256) {
        //TODO: How do we paginate this, by contributors or by charity pools?
        uint256 charities = _iHelp.numberOfCharities();
        uint256 result;
        for (uint256 index = 0; index < charities; index++) {
            CharityPool charity = CharityPool(payable(_iHelp.charityAt(index)));
            uint256 contibutors = charity.numberOfContributors();
            for (uint256 index2 = 0; index2 < contibutors; index2++) {
                result += _iHelp.contirbutorGeneratedInterest(charity.contributorAt(index2), address(charity));
            }
        }
        return result;
    }

    /**
     * Calaculates the total locked value over all charities
     */
    function totalLockedValue(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256) {
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
    function totalCharityLockedValue(CharityPool _charity) external view returns (uint256) {
        return _charity.accountedBalanceUSD();
    }

    /**
     * Get total number of helpers
     */
    function totalHelpers(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256) {
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
            result += charity.numberOfContributors();
        }
        return result;
    }

    /**
     * Get number of helpers in a given charity
     */
    function totalHelpersInCharity(CharityPool _charity) external view returns (uint256) {
        return _charity.numberOfContributors();
    }

    /**
     * Get the total value of direct donations from all charities
     */
    function getTotalDirectDonations(
        iHelpToken _iHelp,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256) {
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
            result += charity.totalDonationsUSD();
        }
        return result;
    }

    /**
     * Get the total value of direct donations for a helper
     */
    function getUserTotalDirectDonations(
        iHelpToken _iHelp,
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256) {
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
        returns (CharityPoolUtils.DirectDonationsCounter memory)
    {
        return _charity.donationsRegistry(_user);
    }
}
