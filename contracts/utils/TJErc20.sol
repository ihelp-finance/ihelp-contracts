// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

interface TJErc20  {
    // address public underlying;
    function mint(uint256 mintAmount) external returns (uint256);

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);

    function balanceOfUnderlying(address owner) external returns (uint256);

    function decimals() external view returns (uint8);

    function getCash() external view returns (uint256);

    function supplyRatePerSecond() external view returns (uint256);
    
    function exchangeRateStored() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOf(address user) external view returns (uint256);

    function burn(uint256 amount) external;
    
    function approve(uint256 amount) external;
    
    // Links to public address variable from CERC200Storage
    function underlying() external view returns (address);
}
