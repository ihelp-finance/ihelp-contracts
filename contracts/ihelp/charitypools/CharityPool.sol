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

import "hardhat/console.sol";

contract CharityPool is OwnableUpgradeable, ReentrancyGuardUpgradeable  {
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
    address public holdingPool;
    address public swapperPool;
    address public stakingPool;
    address public developmentPool;
    address public holdingToken;

    uint256 public __currentProcessingIndex;
    uint256 public __processingGasLimit;

    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => uint256) public accountedBalances;

    mapping(address => uint256) public totalInterestEarned;
    mapping(address => uint256) public currentInterestEarned;
    mapping(address => uint256) public lastTotalInterest;
    mapping(address => uint256) public newTotalInterestEarned;
    mapping(address => uint256) public redeemableInterest;

    IWrappedNative public wrappedNative;
    iHelpTokenInterface public ihelpToken;
    
    SwapperInterface internal swapper;
    EnumerableSet.AddressSet private contributors;
    EnumerableSet.AddressSet private cTokens;


    function transferOperator(address newOperator) public virtual onlyOperatorOrOwner {
        require(newOperator != address(0), "Ownable: new operator is the zero address");
        _transferOperator(newOperator);
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
        holdingPool = configuration.holdingPoolAddress;
        swapperPool = configuration.swapperAddress;
        stakingPool = configuration.stakingPoolAddress;
        developmentPool = configuration.developmentPoolAddress;
        charityWallet = configuration.charityWalletAddress;
        holdingToken = configuration.holdingTokenAddress;
        holdingDecimals = IERC20(configuration.holdingTokenAddress).decimals();
        wrappedNative = IWrappedNative(configuration.wrappedNativeAddress);

        __processingGasLimit = 300_000 * 1e9;
    }

    function setCharityWallet(address _newAddress) public onlyOperatorOrOwner {
        require(_newAddress != charityWallet && _newAddress != address(0), "charity-wallet/invalid-addr");
        //TODO: Ask Mat, i dont think we still need to cleanup the holding pool before updating
        // since the next rewards will go to the new wallets.
        charityWallet = _newAddress;
    }

    function setProcessingGasLimit(uint256 gasLimit) public onlyOperatorOrOwner {
        require(gasLimit > 0, "Limit cannot be 0");
        __processingGasLimit = gasLimit;
    }

    function addCToken(address _cTokenAddress) external onlyOperatorOrOwner {
        cTokens.add(_cTokenAddress);
    }

    function removeCToken(address _cTokenAddress) external onlyOperatorOrOwner {
        _calculateTotalIncrementalInterest(_cTokenAddress);
        _redeemInterest(_cTokenAddress);
        cTokens.remove(_cTokenAddress);

    }

    function getCTokens() public view returns (address[] memory) {
        return cTokens.values();
    }

    function hasCToken(address _cTokenAddress) external view returns(bool) {
        return cTokens.contains(_cTokenAddress);
    }

    /**
     * Allows depositing native tokens to the charity contract
     */
    function depositNative(address _cTokenAddress) public payable {
        require(msg.value > 0, "Native-Funding/small-amount");
        require(address(getUnderlying(_cTokenAddress)) == address(wrappedNative), "Native-Funding/invalid-addr" );
        wrappedNative.deposit{value: msg.value}();

        contributors.add(msg.sender);
        // Deposit the funds
        _depositFrom(msg.sender, _cTokenAddress, msg.value);

        emit Deposited(msg.sender, _cTokenAddress, msg.value);
    }

    /**
     * Allows withdrawing native tokens to the charity contract
     */
    function withdrawNative(address _cTokenAddress, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Funding/small-amount");
        require(address(getUnderlying(_cTokenAddress)) == address(wrappedNative), "Native-Funding/invalid-addr" );
       
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

        contributors.add(msg.sender);
        // Deposit the funds
        _depositFrom(msg.sender, _cTokenAddress, _amount);

        emit Deposited(msg.sender, _cTokenAddress, _amount);
    }
    
    /**
     * @notice Withdraw the sender's entire balance back to them.
     */
    function withdrawTokens(address _cTokenAddress) public {
        uint256 _balance = balances[msg.sender][_cTokenAddress];
        _withdraw(msg.sender, _cTokenAddress, _balance);
        // Withdraw from Compound and transfer
        require(ICErc20(_cTokenAddress).redeemUnderlying(_balance) == 0, "Funding/redeem");
        require(getUnderlying(_cTokenAddress).transfer(msg.sender, _balance), "Funding/transfer");
        emit Withdrawn(msg.sender, _cTokenAddress, _balance);
    }

    function withdrawAmount(address _cTokenAddress, uint256 _amount) public {
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
        require(cTokens.contains(_cTokenAddress), "Invalid configuration");
        // Update the user's balance
        balances[_spender][_cTokenAddress] += _amount;

        // Update the total balance of cTokens of this contract
        accountedBalances[_cTokenAddress] += _amount;

        // Deposit into Compound
        require(getUnderlying(_cTokenAddress).approve(address(_cTokenAddress), _amount), "Funding/approve");
        require(ICErc20(_cTokenAddress).mint(_amount) == 0, "Funding/supply");
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
        }
    }

    function directDonation(address _cTokenAddress, uint256 _amount) public {
        console.log("directDonationAmount", _amount);

        // transfer the tokens to the charity contract
        if (_amount > 0) {
            // Get The underlying token for this cToken
            IERC20 underlyingToken = getUnderlying(_cTokenAddress);

            address tokenaddress = address(underlyingToken);

            // 2.5% to developer pool as native currency of pool
            uint256 developerFee = (_amount * 25) / 1000;

            console.log("Developper Fee::", developerFee);
            require(underlyingToken.transferFrom(msg.sender, developmentPool, developerFee), "Funding/developer transfer");

            // 2.5% to staking pool as swapped dai
            uint256 stakingFee = (_amount * 25) / 1000;

            if (tokenaddress == holdingToken) {
                require(underlyingToken.transferFrom(msg.sender, stakingPool, stakingFee), "Funding/staking transfer");
            } else {
                console.log("Swapping");
                uint256 minAmount = (stakingFee * 50) / 100;

                require(underlyingToken.transferFrom(msg.sender, address(this), stakingFee), "Funding/staking swap transfer");

                require(underlyingToken.approve(swapperPool, stakingFee), "Funding/staking swapper approve");
                console.log("Current Token Balance::", IERC20(tokenaddress).balanceOf(address(this)));
                swapper.swap(tokenaddress, holdingToken, stakingFee, minAmount, stakingPool);
            }

            // 95% to charity as native currency of pool
            uint256 charityDonation = _amount - developerFee - stakingFee;

            // if charityWallet uses holdingPool (for off-chain transfers) then deposit the direction donation amount to this contract
            // all of the direct donation amount in this contract will then be distributed off-chain to the charity
            console.log(charityWallet, holdingPool);

            if (charityWallet == holdingPool) {
                console.log("direct to contract", address(this), charityDonation);
                // require(underlyingToken.approve(address(this), charityDonation), "Funding/approve");
                require(underlyingToken.transferFrom(msg.sender, address(this), charityDonation), "Funding/t-fail");
            } else {
                // deposit the charity share directly to the charities wallet address
                require(underlyingToken.approve(charityWallet, charityDonation), "Funding/approve");

                console.log("Charity Donation::", charityDonation);
                console.log("Underlying Balance:: ", underlyingToken.balanceOf(msg.sender));
                require(underlyingToken.transferFrom(msg.sender, charityWallet, charityDonation), "Funding/t-fail");
            }

            emit DirectDonation(msg.sender, charityWallet, _amount);
        }
    }

    function redeemInterest(address _cTokenAddress) public onlyHelpToken {
        _redeemInterest(_cTokenAddress);
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
            
            address destinationAddress = charityWallet == holdingPool ? address(this) : holdingPool;

            if (tokenaddress == holdingToken) {
                require(underlyingToken.transfer(destinationAddress, amount), "Funding/transfer");
            } else {
                console.log("\nSWAPPING", swapperPool, amount);

                // ensure minimum of 50% redeemed
                uint256 minAmount = (amount * 50) / 100;
                // console.log( holdingToken, amount, minAmount, holdingPool);

                require(underlyingToken.approve(swapperPool, amount), "Funding/approve");

                console.log("TOKEN::", tokenaddress, holdingToken);
                swapper.swap(tokenaddress, holdingToken, amount, minAmount, destinationAddress);
            }

            // reset the lastinterestearned incrementer
            currentInterestEarned[_cTokenAddress] = 0;
            redeemableInterest[_cTokenAddress] = 0;

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
        if(_depositCurrency == holdingToken) {
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

    function getUnderlyingTokenValue(address _cTokenAdddress, uint256 _value) public view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = address(getUnderlying(_cTokenAdddress));
        // TODO: Ask Matt, discuss multi hop tax implications and e2e faling
        // path[1] = swapper.nativeToken();
        path[1] = holdingToken;
        //TODO: Ask Matt, we get the amount in holding tokens here
        uint256 valueInHoldingTokens = swapper.getAmountsOutByPath(path, _value);        
        return valueInHoldingTokens;
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
        // We call the swapper to get the value directly in the form of holding tokens,
        // this means that we dont need to handle decimal scaling anyore, right @Matt?
        console.log("Value" , _value);
        uint256 valueUSD = getUnderlyingTokenValue(_cTokenAddress, _value);
        return valueUSD;
    }

    function setStakingPool(address _pool) public onlyOperatorOrOwner {
        require(_pool != address(0), "Pool cannot be null");
        stakingPool = _pool;
    }

    // increment and return the total interest generated
    function calculateTotalIncrementalInterest(address _cTokenAddress) public onlyHelpToken {
      _calculateTotalIncrementalInterest(_cTokenAddress);
    }

     function _calculateTotalIncrementalInterest(address _cTokenAddress) internal {
        // get the overall new balance
        console.log("");

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
        uint256 result;
        for (uint256 i = 0; i < cTokens.length(); i++) {
            result += convertToUsd(cTokens.at(i),accountedBalances[cTokens.at(i)]);
        }
        return result;
    }

    /**
     *  Expensive function should be called by offchain process
     */
    function newTotalInterestEarnedUSD() public view returns (uint256) {
        uint256 result;
        for (uint256 i = 0; i < cTokens.length(); i++) {
            result += newCTokenTotalUSDInterest(cTokens.at(i));
        }
        return result;
    }

    /**
     *  Expensive function should be called by offchain process
     */
    function totalInterestEarnedUSD() public view returns (uint256) {
        uint256 result;
        for (uint256 i = 0; i < cTokens.length(); i++) {
            result += cTokenTotalUSDInterest(cTokens.at(i));
        }
        return result;
    }

    /**
     *  Expensive function should be called by offchain process
     */
    function calculateTotalInterestEarned() public view returns (uint256) {
        uint256 result;
        for (uint256 i = 0; i < cTokens.length(); i++) {
            result += totalInterestEarned[cTokens.at(i)];
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

    function balanceOfUSD(address _addr) public view returns (uint256) {
        uint256 result;
        for (uint256 i = 0; i < cTokens.length(); i++) {
            result += convertToUsd(cTokens.at(i), balances[_addr][cTokens.at(i)]);
        }
        return result; 
    }

    receive() payable external {}
}
