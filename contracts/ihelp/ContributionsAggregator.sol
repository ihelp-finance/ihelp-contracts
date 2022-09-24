// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../connectors/ConnectorInterface.sol";
import "./PriceFeedProviderInterface.sol";
import "./iHelpTokenInterface.sol";

import "./SwapperUtils.sol";
import "./SwapperInterface.sol";

import "./rewards/CharityRewardDistributor.sol";
import "./rewards/IHelpRewardDistributor.sol";
import "./rewards/ContributorInterestTracker.sol";

import "./ContributionsAggregatorInterface.sol";

contract ContributionsAggregator is
    ContributionsAggregatorInterface,
    OwnableUpgradeable,
    CharityRewardDistributor,
    ContributorInterestTracker,
    IHelpRewardDistributor
{
    /**
     * @notice This event is should be emited every time a redeem of interest is made
     * @param lenderToken - The address of the token that generated the interest (aUSDT, cDAI, jUSDC, etc)
     * @param amount - The amount that was redeemed converted to holding tokens
     */
    event RedeemedInterest(address lenderToken, uint256 amount);

    // The total deposited amount for a given charity by its lender
    mapping(address => mapping(address => uint256)) public charityAccountedBalance;

    // The total deposited amount for a  contributor by lender
    mapping(address => mapping(address => uint256)) public contributorAccountedBalance;

    // We keep track of the total interest generated by a contributor
    mapping(address => uint256) internal _contributorGeneratedInterest;

    // The total deposited amount for a given charity by its lender
    mapping(address => uint256) internal _deposited;

    // Keeps track of holding token rewards for each lender protocol
    mapping(address => uint256) internal _totalRewards;

    // Keeps track of holding token fees for each lender protocol
    mapping(address => uint256) internal _totalFeesCollected;

    SwapperInterface internal swapper;
    iHelpTokenInterface public ihelpToken;

    modifier onlyCharity() {
        require(ihelpToken.hasCharity(msg.sender), "Aggregator/not-allowed");
        _;
    }

    modifier onlyIHelp() {
        require(isIHelp(msg.sender), "iHelp/not-allowed");
        _;
    }

    function isIHelp(address _account) internal view virtual returns (bool) {
        return _account == address(ihelpToken);
    }

    function initialize(address _ihelpAddress) public initializer {
        __Ownable_init();
        ihelpToken = iHelpTokenInterface(_ihelpAddress);
    }

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
    )
        external
        onlyCharity
        updateReward(_charityAddress, _lenderTokenAddress)
        updateIHelpReward(_contributorAddress)
        updateGeneratedInterest(_lenderTokenAddress, _contributorAddress)
    {
        _deposit(_lenderTokenAddress, _charityAddress, _contributorAddress, _amount);
    }

    function _deposit(
        address _lenderTokenAddress,
        address _charityAddress,
        address _contributorAddress,
        uint256 _amount
    ) internal {
        require(_amount != 0, "Funding/deposit-zero");
        require(priceFeedProvider().hasDonationCurrency(_lenderTokenAddress), "Funding/invalid-token");

        // Update the total balance of cTokens of this contract
        charityAccountedBalance[_charityAddress][_lenderTokenAddress] += _amount;
        _deposited[_lenderTokenAddress] += _amount;

        // Keep track of each individual user contribution
        contributorAccountedBalance[_contributorAddress][_lenderTokenAddress] += _amount;

        ConnectorInterface connectorInstance = connector(_lenderTokenAddress);
        IERC20 underlyingToken = IERC20(connectorInstance.underlying(_lenderTokenAddress));

        require(
            underlyingToken.transferFrom(address(msg.sender), address(this), _amount),
            "Funding/underlying-transfer-fail"
        );

        require(underlyingToken.approve(address(connectorInstance), _amount), "Funding/approve");

        // Deposit into Lender
        require(connectorInstance.mint(_lenderTokenAddress, _amount) == 0, "Funding/supply");
    }

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
    )
        external
        onlyCharity
        updateReward(_charityAddress, _lenderTokenAddress)
        updateIHelpReward(_contributorAddress)
        updateGeneratedInterest(_lenderTokenAddress, _contributorAddress)
    {
        _withdraw(_lenderTokenAddress, _charityAddress, _contributorAddress, _amount, _destination);
    }

    function _withdraw(
        address _lenderTokenAddress,
        address _charityAddress,
        address _contributorAddress,
        uint256 _amount,
        address _destination
    ) internal {
        require(_amount <= charityAccountedBalance[_charityAddress][_lenderTokenAddress], "Funding/no-funds");

        charityAccountedBalance[_charityAddress][_lenderTokenAddress] -= _amount;
        contributorAccountedBalance[_contributorAddress][_lenderTokenAddress] -= _amount;
        _deposited[_lenderTokenAddress] -= _amount;

        ConnectorInterface connectorInstance = connector(_lenderTokenAddress);
        IERC20 underlyingToken = IERC20(connectorInstance.underlying(_lenderTokenAddress));

        // Allow connector to pull cTokens from this contracts
        uint256 lenderTokenAmount = connectorInstance.cTokenValueOfUnderlying(_lenderTokenAddress, _amount);
        require(IERC20(_lenderTokenAddress).approve(address(connectorInstance), lenderTokenAmount), "Funding/approve");

        uint256 balanceBefore = underlyingToken.balanceOf(address(this));
        require(connectorInstance.redeemUnderlying(_lenderTokenAddress, _amount) == 0, "Funding/supply");
        uint256 balanceNow = underlyingToken.balanceOf(address(this));

        // Perform a sanity check; TODO: Discuss this
        assert(balanceNow - balanceBefore == _amount);

        require(underlyingToken.transfer(_destination, _amount), "Funding/underlying-transfer-fail");
    }

    /**
     * Claims a iHelp reward amount in the name of a contributor
     * @param _contributor - The contributor
     * @param _amount - The amount of iHelp tokens to be claimed
     */
    function claimIHelpReward(address _contributor, uint256 _amount)
        public
        virtual
        updateIHelpReward(_contributor)
        onlyIHelp
    {
        _claimIHelp(_contributor, _amount);
    }

    /**
     * @notice Redeem intereset from the lenders. The intreset comes in the form of
     * underlying tokens (USDT, DAI, BUSD, etc)
     *
     * @dev The redeemed intrest will be swaped to holding tokens
     *
     * @param _lenderTokenAddress - The address of the lender token
     * @return The redeemed interest expressed in the form of holding tokens
     */
    function redeemInterest(address _lenderTokenAddress) public returns (uint256) {
        return _redeemInterest(_lenderTokenAddress);
    }

    /**
     * This function clears all possible interest from the lender and distributes to the charity pool, dev and staking pools
     */
    function _redeemInterest(address _lenderTokenAddress) internal returns (uint256) {
        uint256 amount = interestEarned(_lenderTokenAddress);
        if (amount > 0) {
            ConnectorInterface connectorInstance = connector(_lenderTokenAddress);

            // Allow connector to pull cTokens from this contracts
            uint256 cTokenValueOfInterest = connectorInstance.cTokenValueOfUnderlying(_lenderTokenAddress, amount);
            require(
                IERC20(_lenderTokenAddress).approve(address(connectorInstance), cTokenValueOfInterest),
                "Funding/approve"
            );
            IERC20 underlyingToken = IERC20(connectorInstance.underlying(_lenderTokenAddress));

            uint256 balanceBefore = underlyingToken.balanceOf(address(this));
            connectorInstance.redeemUnderlying(_lenderTokenAddress, amount);
            uint256 balanceNow = underlyingToken.balanceOf(address(this));

            // Sanity check
            assert(balanceNow - balanceBefore == amount);

            address tokenaddress = address(underlyingToken);
            if (tokenaddress != holdingToken()) {
                // ensure minimum of 50% redeemed
                uint256 minAmount = (amount * 50) / 100;
                minAmount = SwapperUtils.toScale(
                    underlyingToken.decimals(),
                    IERC20(holdingToken()).decimals(),
                    minAmount
                );

                require(underlyingToken.approve(address(swapper), amount), "Funding/approve");
                amount = swapper.swap(tokenaddress, holdingToken(), amount, 0, address(this));
            }

            (uint256 devFeeShare, uint256 stakeFeeShare) = distributeInterestFees(amount);
            addRewards(_lenderTokenAddress, amount, (devFeeShare + stakeFeeShare));

            emit RedeemedInterest(_lenderTokenAddress, amount);
        }

        return amount;
    }

    function interestEarned(address _lenderTokenAddress) internal returns (uint256) {
        uint256 _balance = connector(_lenderTokenAddress).accrueAndGetBalance(_lenderTokenAddress, address(this));
        if (_balance > _deposited[_lenderTokenAddress]) {
            return _balance - _deposited[_lenderTokenAddress];
        } else {
            return 0;
        }
    }

    function addRewards(
        address _lenderTokenAddress,
        uint256 _interest,
        uint256 _fees
    ) internal {
        // We calculated the resulted rewards and update distribute them
        _totalRewards[_lenderTokenAddress] += _interest - _fees;
        _totalFeesCollected[_lenderTokenAddress] += _fees;
        distributeRewards(_lenderTokenAddress);
        trackInterest(_lenderTokenAddress, _interest);
    }

    function distributeInterestFees(uint256 _amount) internal returns (uint256, uint256) {
        (uint256 devFee, uint256 stakeFee, ) = ihelpToken.getFees();
        uint256 devFeeShare = (_amount * devFee) / 1000;
        uint256 stakeFeeShare = (_amount * stakeFee) / 1000;

        (address _developmentPool, address _stakingPool) = ihelpToken.getPools();
        if (devFeeShare > 0) {
            require(IERC20(holdingToken()).transfer(_developmentPool, devFeeShare), "Funding/transfer");
        }

        if (stakeFeeShare > 0) {
            require(IERC20(holdingToken()).transfer(_stakingPool, stakeFeeShare), "Funding/transfer");
        }

        return (devFeeShare, stakeFeeShare);
    }

    function deposited(address _lenderTokenAddress)
        public
        view
        virtual
        override(CharityRewardDistributor, ContributorInterestTracker)
        returns (uint256)
    {
        return _deposited[_lenderTokenAddress];
    }

    /**
     * Calculates the usd value of an underlying token
     * @param _lenderTokenAddress - Address of the lending provider
     * @param _amount - The amount to be converted
     */
    function usdValueoOfUnderlying(address _lenderTokenAddress, uint256 _amount) public view virtual returns (uint256) {
        (uint256 tokenPrice, uint256 priceDecimals) = priceFeedProvider().getUnderlyingTokenPrice(_lenderTokenAddress);

        uint256 valueUSD = _amount * tokenPrice;
        valueUSD = valueUSD / SwapperUtils.safepow(10, priceDecimals);

        ConnectorInterface connectorInstance = connector(_lenderTokenAddress);
        IERC20 underlyingToken = IERC20(connectorInstance.underlying(_lenderTokenAddress));

        return SwapperUtils.toScale(underlyingToken.decimals(), IERC20(holdingToken()).decimals(), valueUSD);
    }

    /**
     * Returns the total value in USD of all underlying contributions
     */
    function contributions() public view override returns (uint256) {
        uint256 usdValue;
        for (uint256 i = 0; i < priceFeedProvider().numberOfDonationCurrencies(); i++) {
            address lenderTokenAddress = priceFeedProvider().getDonationCurrencyAt(i).lendingAddress;
            usdValue += usdValueoOfUnderlying(lenderTokenAddress, _deposited[lenderTokenAddress]);
        }
        return usdValue;
    }

    /**
     * Returns the total value in USD of a contributor deposits
     */
    function contributionsOf(address _contributor) public view override returns (uint256) {
        uint256 usdValue;
        for (uint256 i = 0; i < priceFeedProvider().numberOfDonationCurrencies(); i++) {
            address lenderTokenAddress = priceFeedProvider().getDonationCurrencyAt(i).lendingAddress;
            usdValue += usdValueoOfUnderlying(
                lenderTokenAddress,
                contributorAccountedBalance[_contributor][lenderTokenAddress]
            );
        }
        return usdValue;
    }

    function distributeIHelp(uint256 _newTokens) external onlyIHelp {
        distributeIHelpRewards(_newTokens);
    }

    function balanceOfCharity(address _charityAddress, address _lenderTokenAddress)
        public
        view
        override
        returns (uint256)
    {
        return charityAccountedBalance[_charityAddress][_lenderTokenAddress];
    }

    function balanceOfContributor(address _contributorAddress, address _lenderTokenAddress)
        public
        view
        override
        returns (uint256)
    {
        return contributorAccountedBalance[_contributorAddress][_lenderTokenAddress];
    }

    function totalRewards(address _lenderTokenAddress)
        public
        view
        virtual
        override(CharityRewardDistributor, ContributorInterestTracker, ContributionsAggregatorInterface)
        returns (uint256)
    {
        return _totalRewards[_lenderTokenAddress];
    }

    function totalInterestCollected() public view virtual override returns (uint256) {
        uint256 usdValue;
        for (uint256 i = 0; i < priceFeedProvider().numberOfDonationCurrencies(); i++) {
            address lenderTokenAddress = priceFeedProvider().getDonationCurrencyAt(i).lendingAddress;
            usdValue += usdValueoOfUnderlying(lenderTokenAddress, _totalRewards[lenderTokenAddress] + _totalFeesCollected[lenderTokenAddress]);
        }
        return usdValue;
    }

    /**
     * Claim all charity acummulated holding token rewards. The holding tokens will
     * be sent to the charity pool contract
     * @param _charityAddress - The address of the charity which we claim the rewards for
     */
    function claimAllCharityRewards(address _charityAddress) external {
        for (uint256 i = 0; i < priceFeedProvider().numberOfDonationCurrencies(); i++) {
            address lenderTokenAddress = priceFeedProvider().getDonationCurrencyAt(i).lendingAddress;
            _claim(0, _charityAddress, lenderTokenAddress);
        }
    }

    /**
     * Returns the total claimable interest in holding tokesn for charity
     * @param _charityAddress - The address of the charity
     * @return The claimable interest
     */
    function totalClaimableInterest(address _charityAddress) external view returns (uint256) {
        uint256 total;
        for (uint256 i = 0; i < priceFeedProvider().numberOfDonationCurrencies(); i++) {
            address lenderTokenAddress = priceFeedProvider().getDonationCurrencyAt(i).lendingAddress;
            total += claimableRewardOf(_charityAddress, lenderTokenAddress);
        }
        return total;
    }

    function sweepRewards(address, uint256 _amount) internal override {
        (address _developmentPool, ) = ihelpToken.getPools();
        require(IERC20(holdingToken()).transfer(_developmentPool, _amount), "Funding/transfer");
    }

    function transferReward(
        address _charityAddress,
        address _lenderTokenAddress,
        uint256 _amount
    ) internal virtual override {
        _totalRewards[_lenderTokenAddress] -= _amount;
        require(IERC20(holdingToken()).transfer(_charityAddress, _amount), "Funding/transfer");
    }

    function priceFeedProvider() public view returns (PriceFeedProviderInterface) {
        return PriceFeedProviderInterface(ihelpToken.priceFeedProvider());
    }

    function holdingToken() public view returns (address) {
        return ihelpToken.underlyingToken();
    }

    /**
     * @notice Returns the connector instance for a given lender
     */
    function connector(address _cTokenAddress) internal view returns (ConnectorInterface) {
        return ConnectorInterface(priceFeedProvider().getDonationCurrency(_cTokenAddress).connector);
    }

    function claimReward(address _charityAddress, address _lenderTokenAddress)
        public
        override(CharityRewardDistributor, ContributionsAggregatorInterface)
        returns (uint256)
    {
        return CharityRewardDistributor.claimReward(_charityAddress, _lenderTokenAddress);
    }
}
