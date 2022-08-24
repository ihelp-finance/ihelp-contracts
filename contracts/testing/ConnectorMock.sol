// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../connectors/ConnectorInterface.sol";
import "./ERC20MintableMock.sol";
import "./CTokenMock.sol";
import "../utils/ICErc20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract ConnectorMock is ConnectorInterface {
    using SafeERC20 for IERC20;
    using PRBMathUD60x18 for uint256;

    function mint(address cToken, uint256 mintAmount) external override returns (uint256) {
        IERC20(_underlying(cToken)).safeTransferFrom(msg.sender, address(this), mintAmount);
        IERC20(_underlying(cToken)).safeIncreaseAllowance(address(cToken), mintAmount);
        uint256 result = ICErc20(cToken).mint(mintAmount);
        IERC20(cToken).safeTransfer(msg.sender, IERC20(cToken).balanceOf(address(this)));
        return result;
    }

    function redeemUnderlying(address cToken, uint256 redeemAmount) external override  returns (uint256) {
        address uAddress = address(CTokenMock(cToken).underlying());
        ERC20MintableMock(uAddress).mint(msg.sender,redeemAmount);
        return 0;
    }

    function cTokenValueOfUnderlying(address cToken, uint256 amount) external view returns (uint256) {
        return amount.div(ICErc20(cToken).exchangeRateStored());
    }

    function accrueAndGetBalance(address cToken, address owner) external returns (uint256) {
        return ICErc20(cToken).balanceOfUnderlying(owner);
    }

    function supplyRatePerBlock(address cToken) public view override returns (uint256) {
        return ICErc20(cToken).supplyRatePerBlock();
    }

    function supplyAPR(address cToken, uint256 _blockTime) external view override returns (uint256) {
        uint256 blocksPerDay = (86_400 * 1000) / _blockTime;
        uint256 supplyRatePerDay = supplyRatePerBlock(cToken) * blocksPerDay;
        return supplyRatePerDay * 365;
    }

    function totalSupply(address cToken) external view override returns (uint256) {
        return ICErc20(cToken).totalSupply();
    }

    function balanceOf(address cToken, address user) external view override returns (uint256) {
        return ICErc20(cToken).balanceOf(user);
    }

    function underlying(address cToken) external view override returns (address) {
        return _underlying(cToken);
    }

    function _underlying(address cToken) internal view returns (address) {
        return ICErc20(cToken).underlying();
    }

    function lender() external pure returns (string memory) {
        return "compound";
    }
}
