// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../connectors/ConnectorInterface.sol";
import "./PriceFeedProviderInterface.sol";
import "./iHelpTokenInterface.sol";

import "./SwapperUtils.sol";
import "./SwapperInterface.sol";

import "./rewards/CharityRewardDistributor.sol";

import "hardhat/console.sol";

contract ContributionsAggregator is OwnableUpgradeable, CharityRewardDistributor {

    /**
     * @notice This event is should be emited every time a redeem of interest is made
     * @param lenderToken - The address of the token that generated the interest (aUSDT, cDAI, jUSDC, etc)
     * @param amount - The amount that was redeemed converted to holding tokens
     */
    event RedeemedInterest(address lenderToken, uint256 amount);

    // The total deposited amount for a given charity by its lender
    mapping(address => mapping(address => uint256)) public accountedBalance;

    // The total deposited amount for a given charity by its lender
    mapping(address => uint256) internal _deposited;

    // Keeps track of holding token rewards for each lender protocol
    mapping(address => uint256) internal _totalRewards;

    SwapperInterface internal swapper;
    iHelpTokenInterface public ihelpToken;

    modifier onlyCharity() {
        require(ihelpToken.hasCharity(msg.sender), "Aggregator/not-allowed");
        _;
    }

    function initialize(address _ihelpAddress) public initializer {
        __Ownable_init();
        ihelpToken = iHelpTokenInterface(_ihelpAddress);
    }

    /**
     * @notice Deposits underlying tokens in exchange for lender tokens
     * @param _lenderTokenAddress - The address of the lender token
     * @param _charityAddress - The address of the charity that the end users places his contribution towards
     * @param _amount - The amount of underlying tokens that the contributor deposits
     */
    function deposit(
        address _lenderTokenAddress,
        address _charityAddress,
        uint256 _amount
    ) external onlyCharity updateReward(_charityAddress, _lenderTokenAddress) {
        _deposit(_lenderTokenAddress, _charityAddress, _amount);
    }

    function _deposit(
        address _lenderTokenAddress,
        address _charityAddress,
        uint256 _amount
    ) internal {
        require(_amount != 0, "Funding/deposit-zero");
        require(priceFeedProvider().hasDonationCurrency(_lenderTokenAddress), "Funding/invalid-token");

        // Update the total balance of cTokens of this contract
        accountedBalance[_charityAddress][_lenderTokenAddress] += _amount;
        _deposited[_lenderTokenAddress] += _amount;

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
     * @param _amount - The amount of underlying tokens that the contributor withdrwas
     * @param _destination - The end address that will receive the underlying tokens
     */
    function withdraw(
        address _lenderTokenAddress,
        address _charityAddress,
        uint256 _amount,
        address _destination
    ) external onlyCharity updateReward(_charityAddress, _lenderTokenAddress) {
        _withdraw(_lenderTokenAddress, _charityAddress, _amount, _destination);
    }

    function _withdraw(
        address _lenderTokenAddress,
        address _charityAddress,
        uint256 _amount,
        address _destination
    ) internal {
        require(_amount <= accountedBalance[_charityAddress][_lenderTokenAddress], "Funding/no-funds");

        accountedBalance[_charityAddress][_lenderTokenAddress] -= _amount;
        _deposited[_lenderTokenAddress] -= _amount;

        ConnectorInterface connectorInstance = connector(_lenderTokenAddress);
        IERC20 underlyingToken = IERC20(connectorInstance.underlying(_lenderTokenAddress));

        require(IERC20(_lenderTokenAddress).approve(address(connectorInstance), _amount), "Funding/approve");

        uint256 balanceBefore = underlyingToken.balanceOf(address(this));
        require(connectorInstance.redeemUnderlying(_lenderTokenAddress, _amount) == 0, "Funding/supply");
        uint256 balanceNow = underlyingToken.balanceOf(address(this));

        // Perform a sanity check; TODO: Discuss this
        assert(balanceNow - balanceBefore == _amount);

        require(underlyingToken.transfer(_destination, _amount), "Funding/underlying-transfer-fail");
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
            addRewards(_lenderTokenAddress, amount - (devFeeShare + stakeFeeShare));

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

    function addRewards(address _lenderTokenAddress, uint256 _amount) internal {
        // We calculated the resulted rewards and update distribute them
        _totalRewards[_lenderTokenAddress] += _amount;
        distributeRewards(_lenderTokenAddress);
    }

    function deposited(address _lenderTokenAddress) public view virtual override returns (uint256) {
        return _deposited[_lenderTokenAddress];
    }

    function balanceOf(address _charityAddress, address _lenderTokenAddress) public override view returns (uint256) {
        return accountedBalance[_charityAddress][_lenderTokenAddress];
    }

    function totalRewards(address _lenderTokenAddress) public view virtual override returns (uint256) {
        return _totalRewards[_lenderTokenAddress];
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
}
