// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.0;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
//import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "../utils/SafeDecimalMath.sol";
import "../utils/IERC20.sol";
import "../utils/ICErc20eth.sol";

import "../ihelp/iHelpTokenInterface.sol";
import "../ihelp/SwapperInterface.sol";

import "hardhat/console.sol";

contract CharityPoolETH {

    using SafeMath for uint256;

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

    /**
     * Contract's operator
     */
    string public name;
    string public tokenname;
    address public operator;
    address public charityWallet;
    address public holdingPool;
    address public swapperPool;
    address public holdingToken;
    SwapperInterface internal swapper;

    /**
     * The total of all balances
     */
    uint256 public accountedBalance;

    /**
     * Min funding to be participate in the pool
     */
    uint256 public minFunding;

    uint256 internal __totalInterestEarned;
    uint256 internal __lastInterestEarned;
    uint256 internal __lastTotalInterest;
    uint256 internal __newTotalInterestEarned;
    uint256 internal __interestEarned;
    uint256 internal __redeemableInterest;
    uint256 internal _shareOfUnderlyingCash;

    address[] public contributors;

    /**
     * The Compound cToken that this Pool is bound to.
     */
    ICErc20eth public cToken;
    iHelpTokenInterface public ihelpToken;

    /**
     * The total deposits for each user.
     */
    mapping(address => uint256) internal balances;

    mapping(address => uint256) percentOfContributors;

    mapping(string => address) ctokenAddressLookup;

    bool public isOpen;

    modifier onlyOperator() {
        require(msg.sender == operator, "Funding/is-opetator");
        _;
    }

    modifier onlyOperatorOrOwner() {
        require(
            msg.sender == operator, // || msg.sender == owner(),
            "Funding/is-opetator-or-owner"
        );
        _;
    }

    modifier open() {
        require(isOpen, "Funding/open");
        _;
    }

    function postUpgrade() external { //onlyOperatorOrOwner {
        // rewardToken = IERC20(address(xMPHToken.mph()));
    }

    AggregatorV3Interface internal priceFeed;

    constructor(
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
        uint256 _minFunding
    ) public {

        require(_cToken != address(0), "Funding/ctoken-zero");
        require(_operator != address(0), "Funding/operator-zero");

        cToken = ICErc20eth(_cToken);
        priceFeed = AggregatorV3Interface(_priceFeed);
        ihelpToken = iHelpTokenInterface(_ihelpToken);
        swapper = SwapperInterface(_swapperPool);

        name = _name;
        tokenname = _charityPoolCurrency;

        operator = _operator;
        holdingPool = _holdingPool;
        swapperPool = _swapperPool;
        charityWallet = _charityWallet;
        holdingToken = _holdingToken;

        minFunding = _minFunding;
        isOpen = true;

        __totalInterestEarned = 0;
        __lastInterestEarned = 0;
        __newTotalInterestEarned = 0;
        __lastTotalInterest = 0;
        __redeemableInterest = 0;

    }
    
    receive() external payable {}
    
    fallback() external payable {}

    function deposit()
    public
    payable
    open {
        require(
            minFunding == 0 || msg.value >= minFunding,
            "Funding/small-amount"
        );

        // only push a new contributor if not already present
        bool found = false;
        for (uint i = 0; i < contributors.length; i++) {
            if (contributors[i] == msg.sender) {
                found = true;
                break;
            }
        }
        if (!found) {
            contributors.push(msg.sender);
        }

        // Deposit the funds
        _depositFrom(msg.sender, msg.value);

        emit Deposited(msg.sender, msg.value);
    }

    function sponsor()
    open
    public
    payable {
        require(
            minFunding == 0 || msg.value >= minFunding,
            "Funding/small-amount"
        );

        // only push a new contributor if not already present
        bool found = false;
        for (uint i = 0; i < contributors.length; i++) {
            if (contributors[i] == msg.sender) {
                found = true;
                break;
            }
        }
        if (!found) {
            contributors.push(msg.sender);
        }

        // Deposit the funds
        _depositFrom(msg.sender, msg.value);

        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @notice Deposits into the pool for a user.  Updates their balance and transfers their tokens into this contract.
     * @param _spender The user who is depositing
     * @param _amount The amount they are depositing
     */
    function _depositFrom(address _spender, uint256 _amount) internal {
        require(_amount != 0, "Funding/deposit-zero");
        // Update the user's balance
        balances[msg.sender] = SafeMath.add(balances[msg.sender],_amount);

        // Update the total of this contract
        accountedBalance = SafeMath.add(accountedBalance,_amount);

        // Deposit into Compound
        cToken.mint.value(_amount)();
    }

    /**
     * @notice Withdraw the sender's entire balance back to them.
     */
    function withdraw() public {
        uint256 balance = balances[msg.sender];
        _withdraw(msg.sender, balance);

        emit Withdrawn(msg.sender, balance);
    }

    function withdrawAmount(uint256 _amount) public {
        _withdraw(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);
    }

    /**
     * @notice Transfers tokens from the cToken contract to the sender.  Updates the accounted balance.
     */
    function _withdraw(address payable _sender, uint256 _amount) internal {
        
        uint256 balance = balances[_sender];

        require(_amount <= balance, "Funding/no-funds");

        // Update the user's balance
        if (balance > _amount) {
            balances[_sender] = SafeMath.sub(balance,_amount);
        } else {
            balances[_sender] = 0;
        }

        // Update the total of this contract
        if (accountedBalance > _amount) {
            accountedBalance = SafeMath.sub(accountedBalance,_amount);
        } else {
            accountedBalance = 0;
        }

        // Withdraw from Compound and transfer
        //require(cToken.redeemUnderlying(_amount), "Funding/redeem");
        
        cToken.redeemUnderlying(_amount);
        
        (bool sent, bytes memory data) = msg.sender.call.value(_amount)('');
        require(sent, "Failed to send Ether back to contributor");
        
    }

    function redeemInterest() public { // onlyOperatorOrOwner // ADD THIS

        uint256 amount = __redeemableInterest;

        // console.log('redeemAmount', amount);

        if (amount > 0) {

            cToken.redeemUnderlying(amount);

            console.log('\nSWAPPING ETH', swapperPool, amount);

            // ensure minimum of 50% redeemed
            uint256 minAmount = SafeMath.div(SafeMath.mul(amount,50),100);
            // console.log( holdingToken, amount, minAmount, holdingPool);

            swapper.swapEth.value(amount)(holdingToken, minAmount, holdingPool);

            // reset the lastinterestearned incrementer
            __lastInterestEarned = 0;
            __redeemableInterest = 0;

            emit Rewarded(charityWallet, amount);

        }
    }

    /**
     * @notice Returns a user's total balance.  This includes their sponsorships, fees, open deposits, and committed deposits.
     * @param _addr The address of the user to check.
     * @return The user's current balance.
     */
    function balanceOf(address _addr) public view returns(uint256) {
        return balances[_addr];
    }

    /**
     * @notice Returns the underlying balance of this contract in the cToken.
     * @return The cToken underlying balance for this contract.
     */
    function balance() public returns(uint256) {
        return cToken.balanceOfUnderlying(address(this));
    }

    function interestEarned() public returns(uint256) {

        uint256 balance = balance();

        if (balance > accountedBalance) {
            return SafeMath.sub(balance,accountedBalance);
        }
        else {
            return 0;
        }

    }

    /**
     * @notice Calculates the total estimated interest earned for the given number of blocks
     * @param _blocks The number of block that interest accrued for
     * @return The total estimated interest as a 18 point fixed decimal.
     */
    function estimatedInterestRate(uint256 _blocks)
    public
    view
    returns(uint256) {
        return SafeMath.mul(supplyRatePerBlock(),_blocks);
    }

    /**
     * @notice Convenience function to return the supplyRatePerBlock value from the money market contract.
     * @return The cToken supply rate per block
     */
    function supplyRatePerBlock() public view returns(uint256) {
        return cToken.supplyRatePerBlock();
    }

    function getUnderlyingTokenPrice() public view returns(uint256) {
        (
            uint80 roundID,
            int price,
            uint startedAt,
            uint timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        return uint(price);
    }

    function getContributors() public view returns(address[] memory) {
        return contributors;
    }

    // increment and return the total interest generated
    function calculateTotalIncrementalInterest() public {

        // get the overall new balance
        console.log('');

        // in charityPool currency
        uint256 newTotal = interestEarned();

        console.log('newTotal', newTotal);
        console.log('__lastTotalInterest', __lastTotalInterest);

        if (newTotal > __lastTotalInterest) {

            uint256 currentInterest = SafeMath.sub(newTotal,__lastTotalInterest);
            console.log('newInterest', currentInterest);

            __lastTotalInterest = newTotal;

            __newTotalInterestEarned = currentInterest;
            
            // keep track of the total interest earned as USD
            uint256 tokenPrice = getUnderlyingTokenPrice();
            uint256 convertExchangeRateToWei = 100000000;
            uint256 tokenPriceWei = SafeDecimalMath.divideDecimal(tokenPrice,convertExchangeRateToWei);
            uint256 totalInterestInUSD = SafeDecimalMath.multiplyDecimal(currentInterest,tokenPriceWei);
            
            __totalInterestEarned = SafeMath.add(__totalInterestEarned, totalInterestInUSD);
            
            //__totalInterestEarned = SafeMath.add(__totalInterestEarned, __newTotalInterestEarned);

            __redeemableInterest = SafeMath.add(__redeemableInterest, currentInterest);
            console.log('totalInterestEarned', __totalInterestEarned);
            __lastInterestEarned = currentInterest;

        } else {
            
            __newTotalInterestEarned = 0;
            
        }

    }

    function currentInterestEarned() public view returns(uint256) {
        return __lastInterestEarned;
    }

    function newTotalInterestEarned() public view returns(uint256) {
        return __newTotalInterestEarned;
    }

    function totalInterestEarned() public view returns(uint256) {
        return __totalInterestEarned;
    }

    function getAccountedBalance() public view returns(uint256) {
        return accountedBalance;
    }

    function getCharityWallet() public view returns(address) {
        return charityWallet;
    }
    
    function decimals() public view returns(uint8) {
        return 18;
    }

}