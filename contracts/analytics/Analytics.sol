// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.9;

import "../ihelp/charitypools/CharityPool.sol";
import "../ihelp/iHelpToken.sol";

/**
 * @title Analytics
 */
contract Analytics {

    /**
     * Calaculates the generated interest for a given charity
     */
    function generatedInterest(CharityPool _charityPool) external view  returns(uint256) {
        return _charityPool.calculateTotalInterestEarned();
    }

    /**
     * Calaculates the total generated interest for all charities
     */
    function totalGeneratedInterest(iHelpToken _iHelp) external view returns (uint256) {
        address[] memory charities = _iHelp.getCharities();
        uint256 result;
        for(uint256 index = 0; index < charities.length; index++) {
            result +=  CharityPool(payable(charities[index])).calculateTotalInterestEarned();
        }
        return result;
    }


    /**
     * Calaculates the total generated interest for a given yiled protocol
     */
    function getYieldProtocolGeneratedInterest(iHelpToken _iHelp, address _cTokenAddress) external view returns (uint256) {
        address[] memory charities = _iHelp.getCharities();
        uint256 result;
        for(uint256 index = 0; index < charities.length; index++) {
            CharityPool charity = CharityPool(payable(charities[index]));
            result += charity.totalInterestEarned(_cTokenAddress);
        }
        return result;
    }

    /**
     * Calaculates the total generated interest for a given underlying currency
     */
    function getUnderlyingCurrencyGeneratedInterest(iHelpToken _iHelp, address _underlyingCurrency) external view returns (uint256) {
        address[] memory charities = _iHelp.getCharities();
        uint256 result;
        for(uint256 index = 0; index < charities.length; index++) {
            CharityPool charity = CharityPool(payable(charities[index]));
            
            address[] memory cTokens = charity.getCTokens();

            for(uint256 index2 = 0; index2 < cTokens.length; index2++) {
                 if(address(charity.getUnderlying(cTokens[index2])) == _underlyingCurrency){
                    result += charity.totalInterestEarned(cTokens[index2]);
                }
            }
        }
        return result;
    }

    /**
     * Calaculates generated interest for a given user
     */
    function getUserGeneratedInterest(iHelpToken _iHelp, address _account) external view returns (uint256) {
        address[] memory charities = _iHelp.getCharities();
        uint256 result;
        for(uint256 index = 0; index < charities.length; index++) {
            address charity = charities[index];
            result += _iHelp.contirbutorGeneratedInterest(charity, _account); 
        }
        return result;
    }

     /**
     * Calaculates the total generated interest for a all users
     */
    function getTotalUserGeneratedInterest(iHelpToken _iHelp) external view returns (uint256){
    address[] memory charities = _iHelp.getCharities();
        uint256 result;
        for(uint256 index = 0; index < charities.length; index++) {
            CharityPool charity = CharityPool(payable(charities[index]));
            address[] memory contibutors = charity.getContributors();
            for(uint256 index2 = 0; index2 < contibutors.length; index2++) {
                result += _iHelp.contirbutorGeneratedInterest(address(charity), contibutors[index2]); 
            }
        }
        return result;
    }
}
