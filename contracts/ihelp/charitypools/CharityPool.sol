// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../connectors/ConnectorInterface.sol";
import "./CharityPoolUtils.sol";

import {PRBMathUD60x18} from "@prb/math/contracts/PRBMathUD60x18.sol";

import "../../utils/IERC20.sol";
import "../../utils/IWrappedNative.sol";

import "../iHelpTokenInterface.sol";
import "./CharityPoolInterface.sol";

import "../SwapperInterface.sol";
import "../PriceFeedProviderInterface.sol";

import "../ContributionsAggregatorInterface.sol";
import "../rewards/ContributorInterestTracker.sol";
import "../rewards/CharityInterestTracker.sol";

import "hardhat/console.sol";

contract CharityPool is
    CharityPoolInterface,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ContributorInterestTracker
{
    using PRBMathUD60x18 for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * Emitted when a user deposits into the Pool.
     * @param sender The purchaser of the tickets
     * @param amount The size of the deposit
     */
    event Deposited(address indexed sender, address indexed cTokenAddress, uint256 amount, string memo);

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
    event DirectDonation(address indexed sender, address indexed receiver, uint256 amount, string memo);

    /**
     * Emitted when an offchain claim is made.
     * @param receiver The address of the reward receiver
     * @param amount The amount of the win
     */
    event OffChainClaim(address indexed receiver, uint256 amount);

    uint8 internal holdingDecimals;
    SwapperInterface internal swapper;
    EnumerableSet.AddressSet private contributors;
    mapping(address => CharityPoolUtils.DirectDonationsCounter) private _donationsRegistry;

    string public name;
    address public operator;
    address public charityWallet;
    address public swapperPool;
    address public holdingToken;
    uint256 public totalDonationsUSD;

    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => mapping(address => uint256)) public donationBalances;



    mapping(address => uint256) public accountedBalances;
    mapping(address => uint256) public totalInterestEarned;
    mapping(address => uint256) public currentInterestEarned;
    mapping(address => uint256) public lastTotalInterest;
    mapping(address => uint256) public newTotalInterestEarned;
    mapping(address => uint256) public redeemableInterest;

    IWrappedNative public wrappedNative;
    iHelpTokenInterface public ihelpToken;
    PriceFeedProviderInterface public priceFeedProvider;

    mapping(address => uint256) public lastTrackedInterest;
    mapping(address => uint256) public claimedInterest;


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
        __ReentrancyGuard_init();

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
        priceFeedProvider = PriceFeedProviderInterface(configuration.priceFeedProvider);
    }

    function setCharityWallet(address _newAddress) public onlyOperatorOrOwner {
        require(_newAddress != charityWallet, "charity-wallet/invalid-addr");
        charityWallet = _newAddress;
    }

    function developmentPool() public view returns (address) {
        return ihelpToken.developmentPool();
    }

    function stakingPool() public view returns (address) {
        return ihelpToken.stakingPool();
    }

    function withdrawAll(address _account) external {
        require(msg.sender == _account || msg.sender == address(ihelpToken), "funding/not-allowed");
        uint256 numberOfCurrencies = priceFeedProvider.numberOfDonationCurrencies();
        for (uint256 i = 0; i < numberOfCurrencies; i++) {
            PriceFeedProviderInterface.DonationCurrency memory currency = priceFeedProvider.getDonationCurrencyAt(i);
            _withdrawTokens(currency.lendingAddress, 0, _account);
        }
    }

    /**
     * Allows depositing native tokens to the charity contract
     */
    function depositNative(address _cTokenAddress, string memory _memo) public payable {
        require(msg.value > 0, "Native-Funding/small-amount");
        require(address(getUnderlying(_cTokenAddress)) == address(wrappedNative), "Native-Funding/invalid-addr");
        wrappedNative.deposit{value: msg.value}();
        _depositFrom(msg.sender, _cTokenAddress, msg.value);
        emit Deposited(msg.sender, _cTokenAddress, msg.value, _memo);
    }

    /**
     * Allows withdrawing native tokens to the charity contract
     */
    function withdrawNative(address _cTokenAddress, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Funding/small-amount");
        require(address(getUnderlying(_cTokenAddress)) == address(wrappedNative), "Native-Funding/invalid-addr");

        _withdraw(msg.sender, _cTokenAddress, _amount);

        ContributionsAggregatorInterface aggregatorInstance = contributionsAggregator();
        aggregatorInstance.withdraw(_cTokenAddress, address(this), msg.sender, _amount, address(this));

        wrappedNative.withdraw(_amount);

        payable(msg.sender).transfer(_amount);
        emit Withdrawn(msg.sender, _cTokenAddress, _amount);
    }

    function depositTokens(
        address _cTokenAddress,
        uint256 _amount,
        string memory _memo
    ) public  {
        require(_amount > 0, "Funding/small-amount");
        // Transfer the tokens into this contract
        require(getUnderlying(_cTokenAddress).transferFrom(msg.sender, address(this), _amount), "Funding/t-fail");
        _depositFrom(msg.sender, _cTokenAddress, _amount);
        emit Deposited(msg.sender, _cTokenAddress, _amount, _memo);
    }

    /**
     * @notice Withdraw the sender's tokens.
     */
    function withdrawTokens(address _cTokenAddress, uint256 _amount) public {
        _withdrawTokens(_cTokenAddress, _amount, msg.sender);
    }

    function _withdrawTokens(
        address _cTokenAddress,
        uint256 _amount,
        address _account
    ) internal {
        if (_amount == 0) {
            _amount = balances[_account][_cTokenAddress];
        }

        if (_amount > 0) {
            _withdraw(_account, _cTokenAddress, _amount);

            ContributionsAggregatorInterface aggregatorInstance = contributionsAggregator();
            aggregatorInstance.withdraw(_cTokenAddress, address(this), _account, _amount, _account);

            emit Withdrawn(_account, _cTokenAddress, _amount);
        }
    }

    function _depositFrom(
        address _spender,
        address _cTokenAddress,
        uint256 _amount
    ) internal updateContributorGeneratedInterest(_cTokenAddress, _spender) {
        require(_amount != 0, "Funding/deposit-zero");
        require(priceFeedProvider.hasDonationCurrency(_cTokenAddress), "Native-Funding/invalid-ctoken");
        // Update the user's balance
        balances[_spender][_cTokenAddress] += _amount;

        // Update the total balance of cTokens of this contract
        accountedBalances[_cTokenAddress] += _amount;

        ContributionsAggregatorInterface aggregatorInstance = contributionsAggregator();

        require(getUnderlying(_cTokenAddress).approve(address(aggregatorInstance), _amount), "Funding/approve");

        // Send tokens to aggregator
        aggregatorInstance.deposit(_cTokenAddress, address(this), _spender, _amount);

        contributors.add(_spender);
        ihelpToken.notifyBalanceUpdate(_spender, _amount, true);
    }

    /**
     * @notice Transfers tokens from the cToken contract to the sender.  Updates the accounted balance.
     */
    function _withdraw(
        address _sender,
        address _cTokenAddress,
        uint256 _amount
    ) internal updateContributorGeneratedInterest(_cTokenAddress, _sender) {
        require(_amount <= balances[_sender][_cTokenAddress], "Funding/no-funds");
        balances[_sender][_cTokenAddress] -= _amount;
        ihelpToken.notifyBalanceUpdate(_sender, _amount, false);
        // Update the total of this contract
        if (accountedBalances[_cTokenAddress] > _amount) {
            accountedBalances[_cTokenAddress] -= _amount;
        } else {
            accountedBalances[_cTokenAddress] = 0;
        }

        uint256 cumulativeBalance = cummulativeBalanceOf(_sender);
        if (cumulativeBalance == 0 && _donationsRegistry[_sender].totalContribUSD == 0) {
            contributors.remove(_sender);
        }
    }

    //TODO: What happens to the direct dibations
    function directDonation(
        IERC20 _donationToken,
        uint256 _amount,
        string memory _memo
    ) public {
        if (_amount == 0) {
            return;
        }
        require(
            priceFeedProvider.allowedDirectDonationCurrencies(address(_donationToken)),
            "Donation/invalid-currency"
        );
        require(_donationToken.transferFrom(msg.sender, address(this), _amount), "Funding/staking swap transfer");
        _directDonation(_donationToken, msg.sender, _amount);

        emit DirectDonation(msg.sender, charityWallet, _amount, _memo);
    }

    function _directDonation(
        IERC20 _donationToken,
        address _account,
        uint256 _amount
    ) internal {
        // transfer the tokens to the charity contract
        if (_amount > 0) {
            address tokenaddress = address(_donationToken);

            uint256 holdingTokenAmount = swapper.getNativeRoutedTokenPrice(tokenaddress, holdingToken, _amount);

            // Add up the donation amount before the swap
            _donationsRegistry[_account].totalContribUSD += holdingTokenAmount;

            // keep track of donation balances
            donationBalances[_account][address(_donationToken)] += _amount;

            if (tokenaddress != holdingToken) {
                uint256 minAmount = (holdingTokenAmount * 95) / 100;

                require(_donationToken.approve(swapperPool, _amount), "Funding/staking swapper approve");
                _amount = swapper.swap(tokenaddress, holdingToken, _amount, minAmount, address(this));
            }

            (uint256 devFee, uint256 stakingFee, ) = ihelpToken.getDirectDonationFees();
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
            if (charityWallet != address(0)) {
                // deposit the charity share directly to the charities wallet address
                require(IERC20(holdingToken).transfer(charityWallet, charityDonation), "Funding/t-fail");
            }
            // else {
            //     console.log("direct to contract", address(this), charityDonation);
            // }

            // Update the donations statistcis for the contributor
            _donationsRegistry[_account].totalDonations++;
            _donationsRegistry[_account].contribAfterSwapUSD += _amount;
            _donationsRegistry[_account].devContribUSD += developerFeeAmount;
            _donationsRegistry[_account].stakeContribUSD += stakingFeeAmount;
            _donationsRegistry[_account].charityDonationUSD += charityDonation;
            totalDonationsUSD += _amount;

            contributors.add(_account);
        }
    }

    /**
     * Sends interest form the charity contract to their wallet
     */
    function claimInterest() external {
        ContributionsAggregatorInterface aggregatorInstance = contributionsAggregator();
         for (uint256 i = 0; i < priceFeedProvider.numberOfDonationCurrencies(); i++) {
            address lenderTokenAddress = priceFeedProvider.getDonationCurrencyAt(i).lendingAddress;
    
            uint256 currentInterestTracked = CharityInterestTracker(address(aggregatorInstance)).generatedInterestOfCharity(lenderTokenAddress, address(this));
            uint256 newlyGeneratedInterest = currentInterestTracked - lastTrackedInterest[lenderTokenAddress];
            lastTrackedInterest[lenderTokenAddress] = currentInterestTracked;
            
            // TODO:SHould we also keep track  claimed interest which fees @matt?
            uint256 _claimedInterest = aggregatorInstance.claimReward(address(this), lenderTokenAddress);
            claimedInterest[lenderTokenAddress] += _claimedInterest;
            
            totalInterestEarned[lenderTokenAddress] += newlyGeneratedInterest;
            trackContributorInterest(lenderTokenAddress, newlyGeneratedInterest);
        }

        uint256 amount = IERC20(holdingToken).balanceOf(address(this));
        if (amount == 0) {
            return;
        }

        bool success = true;
        if(address(0) != charityWallet) {
            success = IERC20(holdingToken).transfer(charityWallet, amount);
        }
        require(success, "transfer failed");
    }

    /**
     * Returns the claimbale intrest in holding tokens for this charity pool
     */
    function claimableInterest() public view returns (uint256) {
        ContributionsAggregatorInterface aggregatorInstance = contributionsAggregator();
        return aggregatorInstance.totalClaimableInterest(address(this)) + IERC20(holdingToken).balanceOf(address(this));
    }

    /**
        Claims the interest for charities that do not have an onchain wallet
     */
    function collectOffChainInterest(address _destAddr, address _depositCurrency) external onlyOperatorOrOwner {
        // TODO: Ask Matt how do we handle this
        // uint256 amount = IERC20(holdingToken).balanceOf(address(this));
        // require(amount > 0, "OffChain/nothing-to-claim");
        // uint256 claimAmount = amount;
        // if (_depositCurrency == holdingToken) {
        //     require(IERC20(_depositCurrency).transfer(_destAddr, amount), "Funding/transfer");
        // } else {
        //     address[] memory swapPath = new address[](3);
        //     swapPath[0] = holdingToken;
        //     // Pass trough AVAX to make sure we have liquidity
        //     swapPath[1] = swapper.nativeToken();
        //     swapPath[2] = _depositCurrency;
        //     uint256 minAmount = (amount * 50) / 100;
        //     uint256 amountOut = swapper.swapByPath(swapPath, amount, minAmount, _destAddr);
        //     claimAmount = amountOut;
        // }
        // // Emit the offchain claim event
        // emit OffChainClaim(_destAddr, claimAmount);
    }

    /**
     * @notice Returns the token underlying the cToken.
     * @return An ERC20 token address
     */
    function getUnderlying(address _cTokenAddress) public view returns (IERC20) {
        return IERC20(connector(_cTokenAddress).underlying(_cTokenAddress));
    }

    function connector(address _cTokenAddress) internal view returns (ConnectorInterface) {
        return ConnectorInterface(priceFeedProvider.getDonationCurrency(_cTokenAddress).connector);
    }

    function contributionsAggregator() internal view returns (ContributionsAggregatorInterface) {
        return ContributionsAggregatorInterface(ihelpToken.contributionsAggregator());
    }

    /**
     * @notice Returns a user's total balance.  This includes their sponsorships, fees, open deposits, and committed deposits.
     * @param _account The address of the user to check.
     * @return The user's current balance.
     */
    function balanceOf(address _account, address _cTokenAddress) public view returns (uint256) {
        return balances[_account][_cTokenAddress];
    }

    function balanceOfContributor(address _account, address _cTokenAddress)
        public
        view
        virtual
        override
        returns (uint256)
    {   
       return balances[_account][_cTokenAddress];
    }

    /**
     * @notice Returns the users cumulative balance, if this value is 0 he will be removed from the contibutor list.
     * @param _account The address of the user to check.
     * @return The user's current balance.
     */
    function cummulativeBalanceOf(address _account) internal view returns (uint256) {
        uint256 result;
        PriceFeedProviderInterface.DonationCurrency[] memory cTokens = getAllDonationCurrencies();
        for (uint256 i = 0; i < cTokens.length; i++) {
            address cTokenAddress = cTokens[i].lendingAddress;
            result += balances[_account][cTokenAddress];
        }
        return result;
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
        return connector(_cTokenAddress).supplyRatePerBlock(_cTokenAddress);
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
        if (_value == 0) {
            return 0;
        }
        (uint256 tokenPrice, uint256 priceDecimals) = getUnderlyingTokenPrice(_cTokenAddress);

        uint256 valueUSD = _value * tokenPrice;
        valueUSD = valueUSD / safepow(10, priceDecimals);

        return toHoldingTokenScale(_cTokenAddress, valueUSD);
    }

    function toHoldingTokenScale(address _cTokenAddress, uint256 amount) internal view returns (uint256) {
        uint256 _decimals = decimals(_cTokenAddress);
        if (_decimals < holdingDecimals) {
            amount = amount * safepow(10, holdingDecimals - _decimals);
        } else if (_decimals > holdingDecimals) {
            amount = amount / safepow(10, _decimals - holdingDecimals);
        }
        return amount;
    }

    function accountedBalanceUSD() public view returns (uint256) {
        PriceFeedProviderInterface.DonationCurrency[] memory cTokens = getAllDonationCurrencies();
        return accountedBalanceUSDOfCurrencies(cTokens);
    }

    function accountedBalanceUSDOfCurrencies(PriceFeedProviderInterface.DonationCurrency[] memory cTokens)
        public
        view
        returns (uint256)
    {
        uint256 result;
        for (uint256 i = 0; i < cTokens.length; i++) {
            address cTokenAddress = cTokens[i].lendingAddress;
            result += convertToUsd(cTokenAddress, accountedBalances[cTokenAddress]);
        }
        return result;
    }

    function newTotalInterestEarnedUSD() public view returns (uint256) {
        PriceFeedProviderInterface.DonationCurrency[] memory cTokens = getAllDonationCurrencies();
        return newTotalInterestEarnedUSDByCurrencies(cTokens);
    }

    function newTotalInterestEarnedUSDByCurrencies(PriceFeedProviderInterface.DonationCurrency[] memory cTokens)
        public
        view
        returns (uint256)
    {
        uint256 result;
        for (uint256 i = 0; i < cTokens.length; i++) {
            address cTokenAddress = cTokens[i].lendingAddress;
            result += convertToUsd(cTokenAddress, newTotalInterestEarned[cTokenAddress]);
        }
        return result;
    }

    function totalInterestEarnedUSD() public view returns (uint256) {
        PriceFeedProviderInterface.DonationCurrency[] memory cTokens = getAllDonationCurrencies();
        ContributionsAggregatorInterface aggregatorInstance = contributionsAggregator();
        uint256 result;
        for (uint256 i = 0; i < cTokens.length; i++) {
            result += CharityInterestTracker(address(aggregatorInstance)).generatedInterestOfCharity(cTokens[i].lendingAddress, address(this));
        }
        return result;
    }

    function calculateTotalInterestEarned() public view returns (uint256) {
        uint256 result;
        PriceFeedProviderInterface.DonationCurrency[] memory cTokens = getAllDonationCurrencies();

        for (uint256 i = 0; i < cTokens.length; i++) {
            address cTokenAddress = cTokens[i].lendingAddress;
            result += totalInterestEarned[cTokenAddress];
        }
        return result;
    }

    function cTokenTotalUSDInterest(address _cTokenAddress) public view returns (uint256) {
        return convertToUsd(_cTokenAddress, totalInterestEarned[_cTokenAddress]);
    }

    function decimals(address _cTokenAddress) public view returns (uint8) {
        return getUnderlying(_cTokenAddress).decimals();
    }

    function getAllDonationCurrencies() public view returns (PriceFeedProviderInterface.DonationCurrency[] memory) {
        require(address(priceFeedProvider) != address(0), "not-found/price-feed-provider");
        return priceFeedProvider.getAllDonationCurrencies();
    }

    function balanceOfUSD(address _addr) public view returns (uint256) {
        PriceFeedProviderInterface.DonationCurrency[] memory cTokens = getAllDonationCurrencies();
        uint256 result;
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

    function directDonationNative(string memory _memo) public payable {
        uint256 amount = msg.value;
        wrappedNative.deposit{value: amount}();
        wrappedNative.approve(address(this), amount);
        _directDonation(wrappedNative, msg.sender, amount);
        emit DirectDonation(msg.sender, charityWallet, amount, _memo);
    }

    function deposited(address _cTokenAddress) public view virtual override returns (uint256) {
        return accountedBalances[_cTokenAddress];
    }

    function totalRewards(address _cTokenAddress) public view virtual returns (uint256) {
        ContributionsAggregatorInterface aggregatorInstance = contributionsAggregator();
        return totalInterestEarned[_cTokenAddress] + aggregatorInstance.totalClaimableInterest(address(this));
    }

    function version() public pure virtual returns (uint256) {
        return 4;
    }

    uint256[27] private __gap;


}
