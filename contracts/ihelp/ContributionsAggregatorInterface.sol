// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

interface ContributionsAggregatorInterface {
    /**
     * @notice Deposits underlying tokens in exchange for lender tokens
     * @param _lenderTokenAddress - The address of the lender token
     * @param _charityAddress - The address of the charity that the end users places his contribution towards
     * @param _contributorAddress - The address of the contributor
     * @param _amount - The amount of underlying tokens that the contributor deposits
     */
    function deposit(
        address _lenderTokenAddress,
        address _charityAddress,
        address _contributorAddress,
        uint256 _amount
    ) external;

    /**
     * @notice Withdraws underlying tokens in exchange for lender tokens
     * @param _lenderTokenAddress - The address of the lender token
     * @param _charityAddress - The address of the charity that the end users places his contribution towards
     * @param _contributorAddress - The address of the contributor
     * @param _amount - The amount of underlying tokens that the contributor withdrwas
     * @param _destination - The end address that will receive the underlying tokens
     */
    function withdraw(
        address _lenderTokenAddress,
        address _charityAddress,
        address _contributorAddress,
        uint256 _amount,
        address _destination
    ) external;

    /**
     * Claims a iHelp reward amount in the name of a contributor
     * @param _contributor - The contributor
     * @param _amount - The amount of iHelp tokens to be claimed
     */
    function claimIHelpReward(address _contributor, uint256 _amount) external;

    /**
     * Claim all charity acummulated holding token rewards. The holding tokens will
     * be sent to the charity pool contract
     * @param _charityAddress - The address of the charity which we claim the rewards for
     */
    function claimAllCharityRewards(address _charityAddress) external;

    /**
     * Claim charity acummulated holding token rewards. The holding tokens will
     * be sent to the charity pool contract
     * @param _charityAddress - The address of the charity which we claim the rewards for
     * @param _lenderTokenAddress - The lender token address
     * @return The amount of interest claimed in the form of holding token
     */
    function claimReward(address _charityAddress, address _lenderTokenAddress) external returns (uint256);

    /**
     * Returns the total claimable interest in holding tokesn for charity
     * @param _charityAddress - The address of the charity
     * @return The claimable interest
     */
    function totalClaimableInterest(address _charityAddress) external view returns (uint256);

    /**
     * @notice Redeem intereset from the lenders. The intreset comes in the form of
     * underlying tokens (USDT, DAI, BUSD, etc)
     *
     * @dev The redeemed intrest will be swaped to holding tokens
     *
     * @param _lenderTokenAddress - The address of the lender token
     * @return The redeemed interest expressed in the form of holding tokens
     */
    function redeemInterest(address _lenderTokenAddress) external returns (uint256);
}
