// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./CharityPoolUtils.sol";

import {PRBMathUD60x18} from "@prb/math/contracts/PRBMathUD60x18.sol";

import "../../utils/IERC20.sol";
import "../../utils/ICErc20.sol";

import "../iHelpTokenInterface.sol";
import "../SwapperInterface.sol";

import "hardhat/console.sol";

contract CharityPool is OwnableUpgradeable {
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

    uint8 internal holdingDecimals;
    uint256 public totalInterestEarned;
    uint256 public totalInterestEarnedUSD;
    uint256 public currentInterestEarned;
    uint256 public lastTotalInterest;
    uint256 public newTotalInterestEarned;
    uint256 public newTotalInterestEarnedUSD;
    uint256 public redeemableInterest;

    // TODO: Ask Mat, should we aggregate all the balances to USD
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

    // TODO: Ask Matt, is this a valid way of keeping track of the multiple balances
    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => uint256) public accountedBalances;

    mapping(address => uint256) public balancesUSD;

    /**
        Nested maaping of protocol cToken (BankerJoe, AAVE) -> token DAI, USDT , etc
     */
    mapping(address => bool) public cTokens;

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

    modifier onlyOperatorOrOwner() {
        require(msg.sender == operator || msg.sender == owner(), "is-operator-or-owner");
        _;
    }

    function postUpgrade() external onlyOperatorOrOwner {}

    AggregatorV3Interface internal priceFeed;

    function initialize(CharityPoolUtils.CharityPoolConfiguration memory configuration) public initializer {
        __Ownable_init();

        require(configuration.cTokenAddress != address(0), "Funding/ctoken-zero");
        require(configuration.operatorAddress != address(0), "Funding/operator-zero");

        console.log("Initializing Charity Pool Contract:", configuration.charityName);

        priceFeed = AggregatorV3Interface(configuration.priceFeedAddress);
        ihelpToken = iHelpTokenInterface(configuration.ihelpAddress);
        swapper = SwapperInterface(configuration.swapperAddress);

        name = configuration.charityName;
        tokenname = configuration.charityTokenName;

        operator = configuration.operatorAddress;
        holdingPool = configuration.holdingPoolAddress;
        swapperPool = configuration.swapperAddress;
        stakingPool = configuration.stakingPoolAddress;
        developmentPool = configuration.developmentPoolAddress;
        charityWallet = configuration.developmentPoolAddress;
        holdingToken = configuration.holdingPoolAddress;
        holdingDecimals = IERC20(configuration.holdingTokenAddress).decimals();

        totalInterestEarned = 0;
        totalInterestEarnedUSD = 0;
        currentInterestEarned = 0;
        newTotalInterestEarned = 0;
        newTotalInterestEarnedUSD = 0;
        lastTotalInterest = 0;
        redeemableInterest = 0;
    }

    function setYieldProtocol(address cTokenAddress, bool status) external onlyOperatorOrOwner {
        cTokens[cTokenAddress] = status;
    }

    function deposit(address _cTokenAddress, uint256 _amount) public {
        require(_amount > 0, "Funding/small-amount");
        // Transfer the tokens into this contract
        require(getUnderlying(_cTokenAddress).transferFrom(msg.sender, address(this), _amount), "Funding/t-fail");

        contributors.add(msg.sender);
        // Deposit the funds
        _depositFrom(msg.sender, _cTokenAddress, _amount);

        emit Deposited(msg.sender, _cTokenAddress, _amount);
    }

    // TODO:  @Matt, this is the same as the deposit
    // function sponsor(address _cTokenAddress, uint256 _amount) public {
    //     require(_amount > 0, "Funding/small-amount");
    //     // Transfer the tokens into this contract
    //     require(getUnderlying(_cTokenAddress).transferFrom(msg.sender, address(this), _amount), "Funding/t-fail");

    //     // only push a new contributor if not already present
    //     contributors.add(msg.sender);

    //     _depositFrom(msg.sender, _cTokenAddress, _amount);

    //     emit Deposited(msg.sender, _amount);
    // }

    /**
     * @notice Withdraw the sender's entire balance back to them.
     */
    function withdraw(address _cTokenAddress) public {
        uint256 _balance = balances[msg.sender][_cTokenAddress];
        _withdraw(msg.sender, _cTokenAddress, _balance);
        emit Withdrawn(msg.sender, _cTokenAddress, _balance);
    }

    function withdrawAmount(uint256 _amount, address _cTokenAddress) public {
        _withdraw(msg.sender, _cTokenAddress, _amount);
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
        require(cTokens[_cTokenAddress], "Invalid configuration");
        // Update the user's balance
        balances[_spender][_cTokenAddress] += _amount;

        // Update the total of this contract
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

        // Withdraw from Compound and transfer
        require(ICErc20(_cTokenAddress).redeemUnderlying(_amount) == 0, "Funding/redeem");
        require(getUnderlying(_cTokenAddress).transfer(_sender, _amount), "Funding/transfer");
    }

    function directDonation(uint256 _amount, address _cTokenAddress) public {
        console.log("directDonationAmount", _amount);

        // transfer the tokens to the charity contract
        if (_amount > 0) {
            address tokenaddress = _cTokenAddress;

            // Get The underlying token for this cToken
            IERC20 underlyingToken = getUnderlying(_cTokenAddress);

            // 2.5% to developer pool as native currency of pool
            uint256 developerFee = (_amount * 25) / 1000;
            require(
                underlyingToken.transferFrom(msg.sender, developmentPool, developerFee),
                "Funding/developer transfer"
            );

            // 2.5% to staking pool as swapped dai
            uint256 stakingFee = (_amount * 25) / 1000;

            if (tokenaddress == holdingToken) {
                require(underlyingToken.transferFrom(msg.sender, stakingPool, stakingFee), "Funding/staking transfer");
            } else {
                console.log("Swapping");
                uint256 minAmount = (stakingFee * 50) / 100;

                require(
                    underlyingToken.transferFrom(msg.sender, address(this), stakingFee),
                    "Funding/staking swap transfer"
                );

                require(underlyingToken.approve(swapperPool, stakingFee), "Funding/staking swapper approve");
                swapper.swap(tokenaddress, holdingToken, stakingFee, minAmount, stakingPool);
            }

            // 95% to charity as native currency of pool
            uint256 charityDonation = _amount - developerFee - stakingFee;

            // if charityWallet uses holdingPool (for off-chain transfers) then deposit the direction donation amount to this contract
            // all of the direct donation amount in this contract will then be distributed off-chain to the charity
            console.log(charityWallet, holdingPool);

            if (charityWallet == holdingPool) {
                console.log("direct to contract", address(this), charityDonation);
                require(underlyingToken.approve(address(this), charityDonation), "Funding/approve");
                require(underlyingToken.transferFrom(msg.sender, address(this), charityDonation), "Funding/t-fail");
            } else {
                // deposit the charity share directly to the charities wallet address
                require(underlyingToken.approve(charityWallet, charityDonation), "Funding/approve");
                require(underlyingToken.transferFrom(msg.sender, charityWallet, charityDonation), "Funding/t-fail");
            }

            emit Rewarded(charityWallet, _amount);
        }
    }

    function redeemInterest(address _cTokenAddress) public onlyHelpToken {
        uint256 amount = redeemableInterest;
        ICErc20 cToken = ICErc20(_cTokenAddress);
        console.log("redeemAmount", amount);

        if (amount > 0) {
            // redeem the yield
            cToken.redeemUnderlying(amount);

            address tokenaddress = _cTokenAddress;

            // Get The underlying token for this cToken
            IERC20 underlyingToken = getUnderlying(_cTokenAddress);

            if (tokenaddress == holdingToken) {
                require(underlyingToken.transfer(holdingPool, amount), "Funding/transfer");
            } else {
                console.log("\nSWAPPING", swapperPool, amount);

                // ensure minimum of 50% redeemed
                uint256 minAmount = (amount * 50) / 100;
                // console.log( holdingToken, amount, minAmount, holdingPool);

                require(underlyingToken.approve(swapperPool, amount), "Funding/approve");

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

    function getUnderlyingTokenPrice() public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return uint256(price);
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

    function convertToUsd(uint256 value, uint8 _decimals) internal view returns (uint256) {
        uint256 tokenPrice = getUnderlyingTokenPrice();
        uint256 convertExchangeRateToWei = 100000000;
        uint256 tokenPriceWei = tokenPrice.div(convertExchangeRateToWei);
        uint256 valueUSD = value.mul(tokenPriceWei);
        // calculate the total interest earned in USD - scale by the different in decimals from contract to dai
        if (_decimals < holdingDecimals) {
            valueUSD = valueUSD * safepow(10, holdingDecimals - _decimals);
        } else if (_decimals > holdingDecimals) {
            valueUSD = valueUSD * safepow(10, _decimals - holdingDecimals);
        }
        return valueUSD;
    }

    function setStakingPool(address _pool) public onlyOperatorOrOwner {
        require(_pool != address(0), "Pool cannot be null");
        stakingPool = _pool;
    }

    // increment and return the total interest generated
    function calculateTotalIncrementalInterest(address _cTokenAddress) public onlyHelpToken {
        // get the overall new balance
        console.log("");

        // in charityPool currency
        uint256 newEarned = interestEarned(_cTokenAddress);

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
        newTotalInterestEarnedUSD = convertToUsd(newTotalInterestEarned, decimals(_cTokenAddress));
        totalInterestEarnedUSD = convertToUsd(totalInterestEarned, decimals(_cTokenAddress));
        accountedBalanceUSD = convertToUsd(accountedBalances[_cTokenAddress], decimals(_cTokenAddress));

        for (uint256 ii = 0; ii < contributors.length(); ii++) {
            address contributor = contributors.at(ii);
            balancesUSD[contributor] = convertToUsd(balances[contributor][_cTokenAddress], decimals(_cTokenAddress));
        }
    }

    function decimals(address _cTokenAddress) public view returns (uint8) {
        return getUnderlying(_cTokenAddress).decimals();
    }

    function balanceOfUSD(address _addr) public view returns (uint256) {
        return balancesUSD[_addr];
    }
}
