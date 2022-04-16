// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

interface ICErc20 {
    // address public underlying;
    function mint(uint256 mintAmount) external returns (uint256);

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);

    function balanceOfUnderlying(address owner) external view returns (uint256);

    function getCash() external view returns (uint256);

    function supplyRatePerBlock() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOf(address user) external view returns (uint256);

    function burn(uint256 amount) external;

    // Links to public address variable from CERC200Storage
    function underlying() external view returns (address);
}
