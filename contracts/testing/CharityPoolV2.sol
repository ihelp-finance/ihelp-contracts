// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../ihelp/charitypools/CharityPool.sol";

contract CharityPool2 is CharityPool {
    function version() public pure override returns (uint256) {
        return 3;
    }

    // we use this to test migration
    function __plainSimpleDeposit_dont_use_(
        address _cTokenAddress,
        uint256 _amount
    ) external {
        require(getUnderlying(_cTokenAddress).transferFrom(msg.sender, address(this), _amount), "Funding/t-fail");
        balances[msg.sender][_cTokenAddress] += _amount;

        // Update the total balance of cTokens of this contract
        accountedBalances[_cTokenAddress] += _amount;

        ConnectorInterface connector = connector(_cTokenAddress);

        require(getUnderlying(_cTokenAddress).approve(address(connector), _amount), "Funding/approve");

        connector.mint(_cTokenAddress, _amount);

        addContributor(msg.sender);
    }
}
