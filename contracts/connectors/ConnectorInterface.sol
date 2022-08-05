// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

interface ConnectorInterface {
    function mint(address token, uint256 mintAmount) external returns (uint256); 
    function redeemUnderlying(address token, uint256 redeemAmount) external returns (uint256); 
    function balanceOfUnderlying(address token, address owner) external view returns (uint256); 
    function supplyRatePerBlock(address token) external view returns (uint256); 
    function totalSupply(address token) external view returns (uint256); 
    function balanceOf(address token, address user) external view  returns (uint256); 
    function underlying(address token) external view returns (address); 
    function lender() external  view returns (string memory); 
    function cTokenValueOfUnderlying(address token, uint256 amount) external  view returns (uint256); 

}
