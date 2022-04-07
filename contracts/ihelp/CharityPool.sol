// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {PRBMathUD60x18} from "@prb/math/contracts/PRBMathUD60x18.sol";

import "../utils/IERC20.sol";
import "../utils/ICErc20.sol";

import "./iHelpTokenInterface.sol";
import "./SwapperInterface.sol";

import "hardhat/console.sol";

contract CharityPool is OwnableUpgradeable {
    using PRBMathUD60x18 for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * Emitted when a user deposits into the Pool.
     * @param sender The purchaser of the tickets
     * @param amount The size of the deposit
     */
    event Deposited(address indexed sender, uint256 amount);

    /**
     * Emitted when a user withdraws from the pool.
     * @param sender The user that is withdrawing from the pool
     * @param amount The amount that the user withdrew
     */
    event Withdrawn(address indexed sender, uint256 amount);

    /**
     * Emitted when a draw is rewarded.
     * @param receiver The address of the reward receiver
     * @param amount The amount of the win
     */
    event Rewarded(address indexed receiver, uint256 amount);

    uint8 internal holdingDecimals;
    uint256 public totalInterestEarned;
    uint256 public totalInterestEarnedUSD;
    uint256 public currentInterestEarned;
    uint256 public lastTotalInterest;
    uint256 public newTotalInterestEarned;
    uint256 public newTotalInterestEarnedUSD;
    uint256 public redeemableInterest;
    uint256 public accountedBalance;
    uint256 public accountedBalanceUSD;

    address public operator;
    address public charityWallet;
    address public holdingPool;
    address public swapperPool;
    address public stakingPool;
    address public developmentPool;
    address public holdingToken;

    string public name;
    string public tokenname;

    SwapperInterface internal swapper;
    EnumerableSet.AddressSet private contributors;

    mapping(address => uint256) public balances;
    mapping(address => uint256) public balancesUSD;

    /**
     * The Compound cToken that this Pool is bound to.
     */
    ICErc20 public cToken;
    iHelpTokenInterface public ihelpToken;

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

    modifier onlyOperator() {
        require(msg.sender == operator, "is-operator");
        _;
    }

    modifier onlyOperatorOrOwner() {
        require(msg.sender == operator || msg.sender == owner(), "is-operator-or-owner");
        _;
    }

    function postUpgrade() external onlyOperatorOrOwner {}

    AggregatorV3Interface internal priceFeed;

    function initialize(
        string memory _name,
        address _operator,
        address _holdingPool,
        address _charityWallet,
        string memory _charityPoolCurrency,
        address _cToken,
        address _holdingToken,
        address _priceFeed,
        address _ihelpToken,
        address _swapperPool,
        address _stakingPool,
        address _developmentPool
    ) public initializer {
        __Ownable_init();

        require(_cToken != address(0), "Funding/ctoken-zero");
        require(_operator != address(0), "Funding/operator-zero");

        cToken = ICErc20(_cToken);
        priceFeed = AggregatorV3Interface(_priceFeed);
        ihelpToken = iHelpTokenInterface(_ihelpToken);
        swapper = SwapperInterface(_swapperPool);

        name = _name;
        tokenname = _charityPoolCurrency;

        operator = _operator;
        holdingPool = _holdingPool;
        swapperPool = _swapperPool;
        stakingPool = _stakingPool;
        developmentPool = _developmentPool;
        charityWallet = _charityWallet;
        holdingToken = _holdingToken;
        holdingDecimals = IERC20(holdingToken).decimals();

        totalInterestEarned = 0;
        totalInterestEarnedUSD = 0;
        currentInterestEarned = 0;
        newTotalInterestEarned = 0;
        newTotalInterestEarnedUSD = 0;
        lastTotalInterest = 0;
        redeemableInterest = 0;

        accountedBalance = 0;
        accountedBalanceUSD = 0;
    }

    function deposit(uint256 _amount) public {
        require(_amount > 0, "Funding/small-amount");
        // Transfer the tokens into this contract
        require(token().transferFrom(msg.sender, address(this), _amount), "Funding/t-fail");

        contributors.add(msg.sender);
        // Deposit the funds
        _depositFrom(msg.sender, _amount);

        emit Deposited(msg.sender, _amount);
    }

    function sponsor(uint256 _amount) public {
        require(_amount > 0, "Funding/small-amount");
        // Transfer the tokens into this contract
        require(token().transferFrom(msg.sender, address(this), _amount), "Funding/t-fail");

        // only push a new contributor if not already present
        contributors.add(msg.sender);

        _depositFrom(msg.sender, _amount);

        emit Deposited(msg.sender, _amount);
    }

    /**
     * @notice Withdraw the sender's entire balance back to them.
     */
    function withdraw() public {
        uint256 _balance = balances[msg.sender];
        _withdraw(msg.sender, _balance);
        emit Withdrawn(msg.sender, _balance);
    }

    function withdrawAmount(uint256 _amount) public {
        _withdraw(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);
    }

    /**
     * @notice Deposits into the pool for a user.  Updates their balance and transfers their tokens into this contract.
     * @param _spender The user who is depositing
     * @param _amount The amount they are depositing
     */
    function _depositFrom(address _spender, uint256 _amount) internal {
        require(_amount != 0, "Funding/deposit-zero");
        // Update the user's balance
        balances[_spender] = balances[_spender] + _amount;

        // Update the total of this contract
        accountedBalance = accountedBalance + _amount;

        // Deposit into Compound
        require(token().approve(address(cToken), _amount), "Funding/approve");
        require(cToken.mint(_amount) == 0, "Funding/supply");
    }

    /**
     * @notice Transfers tokens from the cToken contract to the sender.  Updates the accounted balance.
     */
    function _withdraw(address _sender, uint256 _amount) internal {
        uint256 _balance = balances[_sender];

        require(_amount <= _balance, "Funding/no-funds");

        // Update the user's balance
        if (_balance > _amount) {
            balances[_sender] = _balance - _amount;
        } else {
            balances[_sender] = 0;
        }

        // Update the total of this contract
        if (accountedBalance > _amount) {
            accountedBalance = accountedBalance - _amount;
        } else {
            accountedBalance = 0;
        }

        // Withdraw from Compound and transfer
        require(cToken.redeemUnderlying(_amount) == 0, "Funding/redeem");
        require(token().transfer(_sender, _amount), "Funding/transfer");
    }

    function directDonation(uint256 _amount) public {
        console.log("directDonationAmount", _amount);

        // transfer the tokens to the charity contract
        if (_amount > 0) {
            address tokenaddress = address(token());

            // 2.5% to developer pool as native currency of pool
            uint256 developerFee = (_amount * 25) / 1000;

            // Do we need this approval TODO:
            require(token().approve(developmentPool, developerFee), "Funding/developer approve");
            require(token().transferFrom(msg.sender, developmentPool, developerFee), "Funding/developer transfer");

            // 2.5% to staking pool as swapped dai
            uint256 stakingFee = (_amount * 25) / 1000;

            if (tokenaddress == holdingToken) {
                // TODO: - is approve required?
                require(token().approve(stakingPool, stakingFee), "Funding/staking approve");
                require(token().transferFrom(msg.sender, stakingPool, stakingFee), "Funding/staking transfer");
            } else {
                console.log("Swapping");
                uint256 minAmount = (stakingFee * 50) / 100;

                require(token().transferFrom(msg.sender, address(this), stakingFee), "Funding/staking swap transfer");

                require(token().approve(swapperPool, stakingFee), "Funding/staking swapper approve");
                swapper.swap(tokenaddress, holdingToken, stakingFee, minAmount, stakingPool);
            }

            // 95% to charity as native currency of pool
            uint256 charityDonation = _amount - developerFee - stakingFee;

            // if charityWallet uses holdingPool (for off-chain transfers) then deposit the direction donation amount to this contract
            // all of the direct donation amount in this contract will then be distributed off-chain to the charity
            console.log(charityWallet, holdingPool);

            if (charityWallet == holdingPool) {
                console.log("direct to contract", address(this), charityDonation);
                require(token().approve(address(this), charityDonation), "Funding/approve");
                require(token().transferFrom(msg.sender, address(this), charityDonation), "Funding/t-fail");
            } else {
                // deposit the charity share directly to the charities wallet address
                require(token().approve(charityWallet, charityDonation), "Funding/approve");
                require(token().transferFrom(msg.sender, charityWallet, charityDonation), "Funding/t-fail");
            }

            emit Rewarded(charityWallet, _amount);
        }
    }

    function redeemInterest() public onlyHelpToken {
        uint256 amount = redeemableInterest;

        console.log("redeemAmount", amount);

        if (amount > 0) {
            //TODO: what is the underlying token redeem, do we need this require?
            require(cToken.redeemUnderlying(amount) == 0, "Funding/redeem");

            address tokenaddress = address(token());

            if (tokenaddress == holdingToken) {
                require(token().transfer(holdingPool, amount), "Funding/transfer");
            } else {
                console.log("\nSWAPPING", swapperPool, amount);

                // ensure minimum of 50% redeemed
                uint256 minAmount = (amount * 50) / 100;
                // console.log( holdingToken, amount, minAmount, holdingPool);

                require(token().approve(swapperPool, amount), "Funding/approve");

                swapper.swap(tokenaddress, holdingToken, amount, minAmount, holdingPool);
            }

            // reset the lastinterestearned incrementer
            currentInterestEarned = 0;
            redeemableInterest = 0;

            emit Rewarded(charityWallet, amount);
        }
    }

    /**
     * @notice Returns the token underlying the cToken.
     * @return An ERC20 token address
     */
    function token() public view returns (IERC20) {
        return IERC20(cToken.underlying());
    }

    /**
     * @notice Returns a user's total balance.  This includes their sponsorships, fees, open deposits, and committed deposits.
     * @param _addr The address of the user to check.
     * @return The user's current balance.
     */
    function balanceOf(address _addr) public view returns (uint256) {
        return balances[_addr];
    }

    /**
     * @notice Returns the underlying balance of this contract in the cToken.
     * @return The cToken underlying balance for this contract.
     */
    function balance() public view returns (uint256) {
        return cToken.balanceOfUnderlying(address(this));
    }

    function interestEarned() public view returns (uint256) {
        uint256 _balance = balance();

        if (_balance > accountedBalance) {
            return _balance - accountedBalance;
        } else {
            return 0;
        }
    }

    /**
     * @notice Calculates the total estimated interest earned for the given number of blocks
     * @param _blocks The number of block that interest accrued for
     * @return The total estimated interest as a 18 point fixed decimal.
     */
    function estimatedInterestRate(uint256 _blocks) public view returns (uint256) {
        return supplyRatePerBlock() * _blocks;
    }

    /**
     * @notice Convenience function to return the supplyRatePerBlock value from the money market contract.
     * @return The cToken supply rate per block
     */
    function supplyRatePerBlock() public view returns (uint256) {
        return cToken.supplyRatePerBlock();
    }

    function getUnderlyingTokenPrice() public view returns (uint256) {
        // (uint80 roundID, int256 price, uint256 startedAt, uint256 timeStamp, uint80 answeredInRound) = priceFeed.latestRoundData();
        return uint256(100000000); // TESTING - uint(100000000);
    }

    function getContributors() public view returns (address[] memory) {
        return contributors.values();
    }

    function safepow(uint256 base, uint256 exponent) public pure returns (uint256) {
        // TODO: can we delegate to lib? Ask Meth
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

    function convertToUsd(uint256 value) internal view returns (uint256) {
        uint256 tokenPrice = getUnderlyingTokenPrice();
        uint256 convertExchangeRateToWei = 100000000;
        uint256 tokenPriceWei = tokenPrice.div(convertExchangeRateToWei);

        uint256 valueUSD = value.mul(tokenPriceWei);
        // calculate the total interest earned in USD - scale by the different in decimals from contract to dai
        if (decimals() < holdingDecimals) {
            valueUSD = valueUSD * safepow(10, holdingDecimals - decimals());
        } else if (decimals() > holdingDecimals) {
            valueUSD = valueUSD * safepow(10, decimals() - holdingDecimals);
        }

        return valueUSD;
    }

    function setStakingPool(address _pool) public onlyOperatorOrOwner {
        stakingPool = _pool; // TODO: require address(0)?
    }

    // increment and return the total interest generated
    function calculateTotalIncrementalInterest() public onlyHelpToken {
        // get the overall new balance
        console.log("");

        // in charityPool currency
        uint256 newEarned = interestEarned();

        console.log("newEarned", newEarned);
        console.log("currentInterestEarned", currentInterestEarned);

        // MAY HAVE TO TAKE INTO ACCOUNT THE ACTUAL CHANGE IN CONTRIBUTION BALANCE HERE

        if (newEarned > currentInterestEarned) {
            newTotalInterestEarned = newEarned - currentInterestEarned;
            console.log("__newTotalInterestEarned", newTotalInterestEarned);
            currentInterestEarned = newTotalInterestEarned;

            // keep track of the total interest earned as USD
            totalInterestEarned = totalInterestEarned + newTotalInterestEarned;
            console.log("totalInterestEarned", totalInterestEarned);

            redeemableInterest = redeemableInterest + newTotalInterestEarned;
        } else {
            newTotalInterestEarned = 0;
        }

        // set the new usd values
        newTotalInterestEarnedUSD = convertToUsd(newTotalInterestEarned);
        totalInterestEarnedUSD = convertToUsd(totalInterestEarned);
        accountedBalanceUSD = convertToUsd(accountedBalance);

        for (uint256 ii = 0; ii < contributors.length(); ii++) {
            address contributor = contributors.at(ii);
            balancesUSD[contributor] = convertToUsd(balances[contributor]);
        }
    }

    function decimals() public view returns (uint8) {
        return token().decimals();
    }

    function balanceOfUSD(address _addr) public view returns (uint256) {
        return balancesUSD[_addr];
    }
}
