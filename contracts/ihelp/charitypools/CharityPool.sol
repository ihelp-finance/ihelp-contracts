// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./CharityPoolUtils.sol";

import {PRBMathUD60x18} from "@prb/math/contracts/PRBMathUD60x18.sol";

import "../../utils/IERC20.sol";
import "../../utils/ICErc20.sol";
import "../../utils/IWrappedNative.sol";

import "../iHelpTokenInterface.sol";
import "../SwapperInterface.sol";
import "../PriceFeedProvider.sol";

import "hardhat/console.sol";

contract CharityPool is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using PRBMathUD60x18 for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * Emitted when a user deposits into the Pool.
     * @param sender The purchaser of the tickets
     * @param amount The size of the deposit
     */
    event Deposited(address indexed sender, address indexed cTokenAddress, uint256 amount);

    /**
     * Emitted when a user withdraws from the pool.
     * @param sender The user that is withdrawing from the pool
     * @param amount The amount that the user withdrew
     */
    event Withdrawn(address indexed sender, address indexed cTokenAddress, uint256 amount);

    /**
     * Emitted when a draw is rewarded.
     * @param receiver The address of the reward receiver
     * @param amount The amount of the win
     */
    event Rewarded(address indexed receiver, uint256 amount);

    /**
     * Emitted when a draw is rewarded.
     * @param sender The donation sender
     * @param receiver The address of the reward receiver
     * @param amount The amount of the win
     */
    event DirectDonation(address indexed sender, address indexed receiver, uint256 amount);

    /**
     * Emitted when an offchain claim is made.
     * @param receiver The address of the reward receiver
     * @param amount The amount of the win
     */
    event OffChainClaim(address indexed receiver, uint256 amount);

    uint8 internal holdingDecimals;

    string public name;
    address public operator;
    address public charityWallet;
    address public swapperPool;
    address public holdingToken;

    uint256 public totalDonationsUSD;

    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => mapping(address => uint256)) public donationBalances;

    mapping(address => uint256) public accountedBalances;
    mapping(address => CharityPoolUtils.DirectDonationsCounter) private _donationsRegistry;

    mapping(address => uint256) public totalInterestEarned;
    mapping(address => uint256) public currentInterestEarned;
    mapping(address => uint256) public lastTotalInterest;
    mapping(address => uint256) public newTotalInterestEarned;
    mapping(address => uint256) public redeemableInterest;

    IWrappedNative public wrappedNative;
    iHelpTokenInterface public ihelpToken;
    PriceFeedProvider public priceFeedProvider;

    SwapperInterface internal swapper;
    EnumerableSet.AddressSet private contributors;

    function transferOperator(address newOperator) public virtual onlyOperatorOrOwner {
        require(newOperator != address(0), "Ownable: new operator is the zero address");
        _transferOperator(newOperator);
    }

    function donationsRegistry(address _account) public view returns (CharityPoolUtils.DirectDonationsCounter memory) {
        return _donationsRegistry[_account];
    }

    function _transferOperator(address newOperator) internal virtual {
        operator = newOperator;
    }

    modifier onlyHelpToken() {
        require(msg.sender == address(ihelpToken), "is-help-token");
        _;
    }

    modifier onlyOperatorOrOwner() {
        require(msg.sender == operator || msg.sender == owner(), "is-operator-or-owner");
        _;
    }

    function postUpgrade() external onlyOperatorOrOwner {}

    function initialize(CharityPoolUtils.CharityPoolConfiguration memory configuration) public initializer {
        __Ownable_init();

        require(configuration.operatorAddress != address(0), "Funding/operator-zero");

        ihelpToken = iHelpTokenInterface(configuration.ihelpAddress);
        swapper = SwapperInterface(configuration.swapperAddress);

        name = configuration.charityName;

        operator = configuration.operatorAddress;
        swapperPool = configuration.swapperAddress;
        charityWallet = configuration.charityWalletAddress;
        holdingToken = configuration.holdingTokenAddress;
        holdingDecimals = IERC20(configuration.holdingTokenAddress).decimals();
        wrappedNative = IWrappedNative(configuration.wrappedNativeAddress);
        priceFeedProvider = PriceFeedProvider(configuration.priceFeedProvider);
    }

    function setCharityWallet(address _newAddress) public onlyOperatorOrOwner {
        require(_newAddress != charityWallet, "charity-wallet/invalid-addr");
        //TODO: Ask Mat, i dont think we still need to cleanup the holding pool before updating
        // since the next rewards will go to the new wallets.
        charityWallet = _newAddress;
    }

    function developmentPool() public view returns (address) {
        return ihelpToken.developmentPool();
    }

    function stakingPool() public view returns (address) {
        return ihelpToken.stakingPool();
    }

    /**
     * Allows depositing native tokens to the charity contract
     */
    function depositNative(address _cTokenAddress) public payable {
        require(msg.value > 0, "Native-Funding/small-amount");
        require(address(getUnderlying(_cTokenAddress)) == address(wrappedNative), "Native-Funding/invalid-addr");
        wrappedNative.deposit{value: msg.value}();

        // Deposit the funds
        _depositFrom(msg.sender, _cTokenAddress, msg.value);

        emit Deposited(msg.sender, _cTokenAddress, msg.value);
    }

    /**
     * Allows withdrawing native tokens to the charity contract
     */
    function withdrawNative(address _cTokenAddress, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Funding/small-amount");
        require(address(getUnderlying(_cTokenAddress)) == address(wrappedNative), "Native-Funding/invalid-addr");

        require(ICErc20(_cTokenAddress).redeemUnderlying(_amount) == 0, "Funding/redeem");
        _withdraw(msg.sender, _cTokenAddress, _amount);
        wrappedNative.withdraw(_amount);
        payable(msg.sender).transfer(_amount);
        emit Withdrawn(msg.sender, _cTokenAddress, _amount);
    }

    function depositTokens(address _cTokenAddress, uint256 _amount) public {
        require(_amount > 0, "Funding/small-amount");
        // Transfer the tokens into this contract
        require(getUnderlying(_cTokenAddress).transferFrom(msg.sender, address(this), _amount), "Funding/t-fail");

        // Deposit the funds
        _depositFrom(msg.sender, _cTokenAddress, _amount);

        emit Deposited(msg.sender, _cTokenAddress, _amount);
    }

    /**
     * @notice Withdraw the sender's entire balance back to them.
     */
    function withdrawTokens(address _cTokenAddress, uint256 _amount) public {
        if (_amount == 0) {
            _amount = balances[msg.sender][_cTokenAddress];
        }
        _withdraw(msg.sender, _cTokenAddress, _amount);
        // Withdraw from Compound and transfer
        require(ICErc20(_cTokenAddress).redeemUnderlying(_amount) == 0, "Funding/redeem");
        require(getUnderlying(_cTokenAddress).transfer(msg.sender, _amount), "Funding/transfer");
        emit Withdrawn(msg.sender, _cTokenAddress, _amount);
    }

    /**
     * @notice Deposits into the pool for a user.  Updates their balance and transfers their tokens into this contract.
     * @param _spender The user who is depositing
     * @param _amount The amount they are depositing
     */
    function _depositFrom(
        address _spender,
        address _cTokenAddress,
        uint256 _amount
    ) internal {
        require(_amount != 0, "Funding/deposit-zero");
        require(priceFeedProvider.hasDonationCurrency(_cTokenAddress), "Native-Funding/invalid-ctoken");
        // Update the user's balance
        balances[_spender][_cTokenAddress] += _amount;

        // Update the total balance of cTokens of this contract
        accountedBalances[_cTokenAddress] += _amount;

        // Deposit into Compound
        require(getUnderlying(_cTokenAddress).approve(address(_cTokenAddress), _amount), "Funding/approve");
        require(ICErc20(_cTokenAddress).mint(_amount) == 0, "Funding/supply");

        contributors.add(_spender);
    }

    /**
     * @notice Transfers tokens from the cToken contract to the sender.  Updates the accounted balance.
     */
    function _withdraw(
        address _sender,
        address _cTokenAddress,
        uint256 _amount
    ) internal {
        require(_amount <= balances[_sender][_cTokenAddress], "Funding/no-funds");
        balances[_sender][_cTokenAddress] -= _amount;

        // Update the total of this contract
        if (accountedBalances[_cTokenAddress] > _amount) {
            accountedBalances[_cTokenAddress] -= _amount;
        } else {
            accountedBalances[_cTokenAddress] = 0;
            contributors.remove(_sender);
        }
    }

    function directDonation(IERC20 _donationToken, uint256 _amount) public {
        if (_amount == 0) {
            return;
        }

        require(
            priceFeedProvider.allowedDirectDonationCurrencies(address(_donationToken)),
            "Donation/invalid-currency"
        );
        require(_donationToken.transferFrom(msg.sender, address(this), _amount), "Funding/staking swap transfer");
        _directDonation(_donationToken, msg.sender, _amount);
    }

    function _directDonation(
        IERC20 _donationToken,
        address _account,
        uint256 _amount
    ) internal {
        console.log("directDonationAmount", _amount);
        // transfer the tokens to the charity contract
        if (_amount > 0) {
            address tokenaddress = address(_donationToken);
            // Add up the donation amount before the swap
            _donationsRegistry[_account].totalContribUSD += swapper.getNativeRoutedTokenPrice(
                tokenaddress,
                holdingToken,
                _amount
            );

            // keep track of donation balances
            donationBalances[_account][address(_donationToken)] += _amount;

            if (tokenaddress != holdingToken) {
                console.log("Swapping");
                uint256 minAmount = (_amount * 95) / 100;

                // TODO: This should enable support for tokens that have fee on transfer
                uint256 receivedAmount = _donationToken.balanceOf(address(this));

                require(_donationToken.approve(swapperPool, receivedAmount), "Funding/staking swapper approve");
                console.log("Current Token Balance::", receivedAmount);
                _amount = swapper.swap(tokenaddress, holdingToken, receivedAmount, minAmount, address(this));
            }

            (uint256 devFee, uint256 stakingFee, ) = ihelpToken.getFees();
            // 2.5% to developer pool as native currency of pool
            uint256 developerFeeAmount = (_amount * devFee) / 1000;

            // 2.5% to staking pool as swapped dai
            uint256 stakingFeeAmount = (_amount * stakingFee) / 1000;

            (address _developmentPool, address _stakingPool) = ihelpToken.getPools();

            require(IERC20(holdingToken).transfer(_developmentPool, developerFeeAmount), "Funding/developer transfer");
            require(IERC20(holdingToken).transfer(_stakingPool, stakingFeeAmount), "Funding/developer transfer");

            // 95% to charity as native currency of pool
            uint256 charityDonation = _amount - developerFeeAmount - stakingFeeAmount;

            // if charityWallet uses address(0) (for off-chain transfers) then deposit the direction donation amount to this contract
            // all of the direct donation amount in this contract will then be distributed off-chain to the charity
            console.log("Charity Wallet::", charityWallet);

            if (charityWallet != address(0)) {
                // deposit the charity share directly to the charities wallet address
                console.log("Charity Donation::", charityDonation);
                console.log("Underlying Balance:: ", _donationToken.balanceOf(_account));
                require(IERC20(holdingToken).transfer(charityWallet, charityDonation), "Funding/t-fail");
            } else {
                console.log("direct to contract", address(this), charityDonation);
            }

            // Update the donations statistcis for the contributor
            _donationsRegistry[_account].totalDonations++;
            _donationsRegistry[_account].contribAfterSwapUSD += _amount;
            _donationsRegistry[_account].devContribUSD += developerFeeAmount;
            _donationsRegistry[_account].stakeContribUSD += stakingFeeAmount;
            _donationsRegistry[_account].charityDonationUSD += charityDonation;
            totalDonationsUSD += _amount;

            emit DirectDonation(_account, charityWallet, _amount);
        }
    }

    function redeemInterest(address _cTokenAddress) public onlyHelpToken {
        _redeemInterest(_cTokenAddress);
    }

    /**
     * Sends interest form the charity contract to their wallet
     */
    function claimInterest() external {
        uint256 amount = IERC20(holdingToken).balanceOf(address(this));
        console.log("CHARITY_POOL::CLAIM:::", amount);
        if (amount == 0) {
            return;
        }
        bool success = IERC20(holdingToken).transfer(charityWallet, amount);
        require(success, "transfer failed");
    }

    /**
     * Returns the claimbale intrest in holding tokens for this charity pool
     */
    function claimableInterest() public view returns (uint256) {
        return IERC20(holdingToken).balanceOf(address(this));
    }

    function _redeemInterest(address _cTokenAddress) internal {
        uint256 amount = redeemableInterest[_cTokenAddress];
        ICErc20 cToken = ICErc20(_cTokenAddress);
        console.log("redeemAmount", amount);

        if (amount > 0) {
            // redeem the yield
            cToken.redeemUnderlying(amount);

            // Get The underlying token for this cToken
            IERC20 underlyingToken = getUnderlying(_cTokenAddress);

            address tokenaddress = address(underlyingToken);
            if (tokenaddress != holdingToken) {
                console.log("\nSWAPPING", swapperPool, amount);

                // ensure minimum of 50% redeemed
                uint256 minAmount = (amount * 50) / 100;

                require(underlyingToken.approve(swapperPool, amount), "Funding/approve");

                console.log("TOKEN::", tokenaddress, holdingToken);
                amount = swapper.swap(tokenaddress, holdingToken, amount, minAmount, address(this));
            }
            (uint256 devFee, uint256 stakeFee, ) = ihelpToken.getFees();
            uint256 devFeeShare = (amount * devFee) / 1000;
            uint256 stakeFeeShare = (amount * stakeFee) / 1000;

            console.log("Dev and stake amounts::", devFeeShare, stakeFeeShare, amount);
            console.log("Dev and stake fees::", devFee, stakeFee);

            (address _developmentPool, address _stakingPool) = ihelpToken.getPools();
            require(IERC20(holdingToken).transfer(_developmentPool, devFeeShare), "Funding/transfer");
            require(IERC20(holdingToken).transfer(_stakingPool, stakeFeeShare), "Funding/transfer");

            // reset the lastinterestearned incrementer
            currentInterestEarned[_cTokenAddress] = 0;
            redeemableInterest[_cTokenAddress] = 0;

            // TODO: Ask matt do we have to reset the interest after claiming?
            newTotalInterestEarned[_cTokenAddress] = 0;

            emit Rewarded(charityWallet, amount);
        }
    }

    /**
        Claims the interest for charities that do not have an onchain wallet
     */
    function collectOffChainInterest(address _destAddr, address _depositCurrency) external onlyOperatorOrOwner {
        uint256 amount = IERC20(holdingToken).balanceOf(address(this));
        require(amount > 0, "OffChain/nothing-to-claim");

        uint256 claimAmount = amount;
        if (_depositCurrency == holdingToken) {
            require(IERC20(_depositCurrency).transfer(_destAddr, amount), "Funding/transfer");
        } else {
            address[] memory swapPath = new address[](3);
            swapPath[0] = holdingToken;

            // Pass trough AVAX to make sure we have liquidity
            swapPath[1] = swapper.nativeToken();
            swapPath[2] = _depositCurrency;

            uint256 minAmount = (amount * 50) / 100;

            uint256 amountOut = swapper.swapByPath(swapPath, amount, minAmount, _destAddr);
            claimAmount = amountOut;
        }
        // Emit the offchain claim event
        emit OffChainClaim(_destAddr, claimAmount);
    }

    /**
     * @notice Returns the token underlying the cToken.
     * @return An ERC20 token address
     */
    function getUnderlying(address cTokenAddress) public view returns (IERC20) {
        return IERC20(ICErc20(cTokenAddress).underlying());
    }

    /**
     * @notice Returns a user's total balance.  This includes their sponsorships, fees, open deposits, and committed deposits.
     * @param _account The address of the user to check.
     * @return The user's current balance.
     */
    function balanceOf(address _account, address _cTokenAddress) public view returns (uint256) {
        return balances[_account][_cTokenAddress];
    }

    /**
     * @notice Returns the underlying balance of this contract in the cToken.
     * @return The cToken underlying balance for this contract.
     */
    function balance(address _cTokenAddress) public view returns (uint256) {
        return ICErc20(_cTokenAddress).balanceOfUnderlying(address(this));
    }

    function interestEarned(address _cTokenAddress) public view returns (uint256) {
        uint256 _balance = balance(_cTokenAddress);

        if (_balance > accountedBalances[_cTokenAddress]) {
            return _balance - accountedBalances[_cTokenAddress];
        } else {
            return 0;
        }
    }

    /**
     * @notice Calculates the total estimated interest earned for the given number of blocks
     * @param _blocks The number of block that interest accrued for
     * @return The total estimated interest as a 18 point fixed decimal.
     */
    function estimatedInterestRate(uint256 _blocks, address _cTokenAddres) public view returns (uint256) {
        return supplyRatePerBlock(_cTokenAddres) * _blocks;
    }

    /**
     * @notice Convenience function to return the supplyRatePerBlock value from the money market contract.
     * @return The cToken supply rate per block
     */
    function supplyRatePerBlock(address _cTokenAddress) public view returns (uint256) {
        return ICErc20(_cTokenAddress).supplyRatePerBlock();
    }

    function getUnderlyingTokenPrice(address _cTokenAdddress) public view returns (uint256, uint256) {
        require(address(priceFeedProvider) != address(0), "not-found/price-feed-provider");
        return priceFeedProvider.getUnderlyingTokenPrice(_cTokenAdddress);
    }

    function getContributors() public view returns (address[] memory) {
        return contributors.values();
    }

    function safepow(uint256 base, uint256 exponent) public pure returns (uint256) {
        if (exponent == 0) {
            return 1;
        } else if (exponent == 1) {
            return base;
        } else if (base == 0 && exponent != 0) {
            return 0;
        } else {
            uint256 z = base;
            for (uint256 i = 1; i < exponent; i++) z = z * base;
            return z;
        }
    }

    function convertToUsd(address _cTokenAddress, uint256 _value) internal view returns (uint256) {
        (uint256 tokenPrice, uint256 priceDecimals) = getUnderlyingTokenPrice(_cTokenAddress);
        uint256 valueUSD = _value * tokenPrice;
        valueUSD = valueUSD / safepow(10, priceDecimals);
        uint256 _decimals = decimals(_cTokenAddress);
        if (_decimals < holdingDecimals) {
            valueUSD = valueUSD * safepow(10, holdingDecimals - _decimals);
        } else if (_decimals > holdingDecimals) {
            valueUSD = valueUSD * safepow(10, _decimals - holdingDecimals);
        }
        return valueUSD;
    }

    // increment and return the total interest generated
    function calculateTotalIncrementalInterest(address _cTokenAddress) public onlyHelpToken {
        _calculateTotalIncrementalInterest(_cTokenAddress);
    }

    function _calculateTotalIncrementalInterest(address _cTokenAddress) internal {
        // in charityPool currency
        uint256 newEarned = interestEarned(_cTokenAddress);

        console.log("newEarned", newEarned);
        console.log("currentInterestEarned", currentInterestEarned[_cTokenAddress]);

        if (newEarned > currentInterestEarned[_cTokenAddress]) {
            newTotalInterestEarned[_cTokenAddress] = newEarned - currentInterestEarned[_cTokenAddress];
            console.log("__newTotalInterestEarned", newTotalInterestEarned[_cTokenAddress]);
            currentInterestEarned[_cTokenAddress] = newTotalInterestEarned[_cTokenAddress];

            // keep track of the total interest earned as USD
            totalInterestEarned[_cTokenAddress] += newTotalInterestEarned[_cTokenAddress];
            console.log("totalInterestEarned", totalInterestEarned[_cTokenAddress]);

            redeemableInterest[_cTokenAddress] += newTotalInterestEarned[_cTokenAddress];
        } else {
            newTotalInterestEarned[_cTokenAddress] = 0;
        }
    }

    /**
     *  Expensive function should be called by offchain process
     */
    function accountedBalanceUSD() public view returns (uint256) {
        PriceFeedProvider.DonationCurrency[] memory cTokens = priceFeedProvider.getAllDonationCurrencies();
        uint256 result;
        for (uint256 i = 0; i < cTokens.length; i++) {
            address cTokenAddress = cTokens[i].lendingAddress;
            result += convertToUsd(cTokenAddress, accountedBalances[cTokenAddress]);
        }
        return result;
    }

    /**
     *  Expensive function should be called by offchain process
     */
    function newTotalInterestEarnedUSD() public view returns (uint256) {
        PriceFeedProvider.DonationCurrency[] memory cTokens = priceFeedProvider.getAllDonationCurrencies();
        uint256 result;
        for (uint256 i = 0; i < cTokens.length; i++) {
            address cTokenAddress = cTokens[i].lendingAddress;
            result += newCTokenTotalUSDInterest(cTokenAddress);
        }
        return result;
    }

    /**
     *  Expensive function should be called by offchain process
     */
    function totalInterestEarnedUSD() public view returns (uint256) {
        PriceFeedProvider.DonationCurrency[] memory cTokens = priceFeedProvider.getAllDonationCurrencies();
        uint256 result;
        for (uint256 i = 0; i < cTokens.length; i++) {
            address cTokenAddress = cTokens[i].lendingAddress;
            result += cTokenTotalUSDInterest(cTokenAddress);
        }
        return result;
    }

    /**
     *  Expensive function should be called by offchain process
     */
    function calculateTotalInterestEarned() public view returns (uint256) {
        uint256 result;
        PriceFeedProvider.DonationCurrency[] memory cTokens = priceFeedProvider.getAllDonationCurrencies();
        for (uint256 i = 0; i < cTokens.length; i++) {
            address cTokenAddress = cTokens[i].lendingAddress;
            result += totalInterestEarned[cTokenAddress];
        }
        return result;
    }

    function cTokenTotalUSDInterest(address _cTokenAddress) public view returns (uint256) {
        return convertToUsd(_cTokenAddress, totalInterestEarned[_cTokenAddress]);
    }

    function newCTokenTotalUSDInterest(address _cTokenAddress) public view returns (uint256) {
        return convertToUsd(_cTokenAddress, newTotalInterestEarned[_cTokenAddress]);
    }

    function decimals(address _cTokenAddress) public view returns (uint8) {
        return getUnderlying(_cTokenAddress).decimals();
    }

    function getAllDonationCurrencies() public view returns (PriceFeedProvider.DonationCurrency[] memory) {
        return priceFeedProvider.getAllDonationCurrencies();
    }

    function balanceOfUSD(address _addr) public view returns (uint256) {
        require(address(priceFeedProvider) != address(0), "not-found/price-feed-provider");
        uint256 result;
        PriceFeedProvider.DonationCurrency[] memory cTokens = priceFeedProvider.getAllDonationCurrencies();
        for (uint256 i = 0; i < cTokens.length; i++) {
            address cTokenAddress = cTokens[i].lendingAddress;
            result += convertToUsd(cTokenAddress, balances[_addr][cTokenAddress]);
        }
        return result;
    }

    function numberOfContributors() public view returns (uint256) {
        return contributors.length();
    }

    function contributorAt(uint256 index) public view returns (address) {
        return contributors.at(index);
    }

    receive() external payable {}

    function directDonationNative() public payable {
        uint256 amount = msg.value;
        wrappedNative.deposit{value: amount}();
        wrappedNative.approve(address(this), amount);
        _directDonation(wrappedNative, msg.sender, amount);
    }
}
