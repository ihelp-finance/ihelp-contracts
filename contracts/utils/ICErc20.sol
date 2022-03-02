// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.0;

interface ICErc20 {
   // address public underlying;
    function mint(uint256 mintAmount) external returns (uint);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint);
    function balanceOfUnderlying(address owner) external returns (uint);
    function getCash() external view returns (uint);
    function supplyRatePerBlock() external view returns (uint);
    function totalSupply() external view returns (uint);
    function balanceOf(address user) external view returns (uint);
    function burn(uint256 amount) external;
    // Links to public address variable from CERC200Storage
    function underlying() external view returns (address);
}