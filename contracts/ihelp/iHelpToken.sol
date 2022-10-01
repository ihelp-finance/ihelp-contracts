// SPDX-License-Identifier: GPL-3.0
// prettier-ignore

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {PRBMathUD60x18} from "@prb/math/contracts/PRBMathUD60x18.sol";

import "../utils/IERC20.sol";
import "./charitypools/CharityPoolInterface.sol";
import "../ihelp/PriceFeedProviderInterface.sol";
import "./ContributionsAggregator.sol";

import "hardhat/console.sol";

contract iHelpToken is ERC20CappedUpgradeable, OwnableUpgradeable {
    using PRBMathUD60x18 for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;
    
    EnumerableSet.AddressSet private charityPoolList;
    EnumerableSet.AddressSet private uniqueContributors;

    // number that represents the cumulated contributions for a given contributor, 
    // if this number reaches 0, the contributor will be removed from the uniqueContributors list
    mapping(address => uint256) public _contributionsSum;

    struct ProcessingState {
        uint256 newInterestUS;
        uint256 totalCharityPoolContributions;
        uint256 tokensToCirculate;
        uint256 tokensToCirculateInCurrentPhase;
        uint256 i;
        uint256 ii;
        uint256 status;
    }

    address public operator;
    address public stakingPool;
    address public developmentPool;

    // Processing gas limit
    uint256 public __processingGasLimit;

    uint256 public __totalCirculating;
    uint256 public __totalSupply;
    uint256 public __tokenPhase;
    uint256 public __interestGenerated;
    uint256 public __tokensLastDripped;
    uint256 public __tokensMintedPerPhase;
    uint256 public __lastProcessedInterestUSD;

    uint256 public charityShareOfInterest;
    uint256 public developmentShareOfInterest;
    uint256 public stakingShareOfInterest;
    uint256 public totalContributorGeneratedInterest;

    mapping(uint256 => uint256) public tokensPerInterestByPhase;
    mapping(uint256 => uint256) public cumulativeInterestByPhase;

    mapping(address => uint256) public contributorTokenClaims;
    mapping(address => mapping(address => uint256)) public contributorGeneratedInterest;

    ProcessingState public processingState;
    IERC20 public underlyingToken;
    PriceFeedProviderInterface public priceFeedProvider;
    
    EnumerableSet.AddressSet private charitiesToProcess;
    
    uint256 public directDonationCharityShareOfInterest;
    uint256 public directDonationDevelopmentShareOfInterest;
    uint256 public directDonationStakingShareOfInterest;

    ContributionsAggregator public contributionsAggregator;

    /**
     * Emited after running the upkeep function
     * @param totalAmount - The total interest in holding tokens
     * @param drippedIhelp - Total help tokens that where driped for this upkeep
     */
    event RedeemedInterest(uint256 totalAmount, uint256 drippedIhelp);

    /**
     * Emited when a phase change ouccurs
     * @param newPhase    - The new phase index
     * @param previousDrip - The help tokens driped before the phase change
     * @param newPhaseDrip - The help tokens that where driped for this upkeep
     */
    event PhaseChange(uint256 newPhase, uint256 previousDrip, uint256 newPhaseDrip);

    function setTokenPhases() internal {
        uint256 numberPhases = 10;

        uint256 lastInterest = 600000;
        uint256 cumulativeInterest = 0;
        uint256 lastCumulative = 0;

        for (uint256 phase = 1; phase <= numberPhases; phase++) {
            if (phase == 1) {
                lastInterest = lastInterest;
            } else {
                lastInterest = lastInterest * 2;
            }

            cumulativeInterest += lastInterest;
            cumulativeInterestByPhase[phase] = cumulativeInterest;
            tokensPerInterestByPhase[phase] = __tokensMintedPerPhase.div(cumulativeInterest - lastCumulative);

            lastCumulative = cumulativeInterest;
        }
    }

    function setCumulativeEmissionRate(uint256 _phase, uint256 _newRate) external onlyOperatorOrOwner {
        cumulativeInterestByPhase[_phase] = _newRate;
    }

    function setTokensPerInterestPhase(uint256 _phase, uint256 _newRate) external onlyOperatorOrOwner {
        tokensPerInterestByPhase[_phase] = _newRate;
    }

    function transferOperator(address newOperator) public virtual onlyOperatorOrOwner {
        require(newOperator != address(0), "Ownable: new operator is the zero address");
        _transferOperator(newOperator);
    }

    function _transferOperator(address newOperator) internal virtual {
        operator = newOperator;
    }

    modifier onlyOperatorOrOwner() {
        require(msg.sender == operator || msg.sender == owner(), "Funding/is-operator-or-owner");
        _;
    }

    function postUpgrade() external {}

    function initialize(
        string memory _name,
        string memory _symbol,
        address _operator,
        address _developmentPool,
        address _underlyingToken,
        address _priceFeedProviderAddress
    ) public initializer {
        __ERC20_init(_name, _symbol);
        __ERC20Capped_init_unchained(20_000_000 * 1e18);
        __Ownable_init();

        operator = _operator;
        developmentPool = _developmentPool;
        underlyingToken = IERC20(_underlyingToken);
        priceFeedProvider = PriceFeedProviderInterface(_priceFeedProviderAddress);

        __tokensMintedPerPhase = 1_000_000;

        // scale these later in the contract based on the charity pool decicals
        charityShareOfInterest = 800; // 80%
        developmentShareOfInterest = 100; // 10%
        stakingShareOfInterest = 100; // 10%
        
        directDonationCharityShareOfInterest = 950; // 95%
        directDonationDevelopmentShareOfInterest = 25; // 2.5%
        directDonationStakingShareOfInterest = 25; // 2.5%

        __totalSupply = __tokensMintedPerPhase * 1e18;
        __totalCirculating = 0;

        __tokenPhase = 1;

        __lastProcessedInterestUSD = 0;
        __tokensLastDripped = 0;

        setTokenPhases();

        // mint the initial HELP phase and premine tokens
        _mint(operator, __tokensMintedPerPhase * 1e18);

        uint256 premineTokens = 10_000_000;
        _mint(developmentPool, premineTokens * 1e18);

        __processingGasLimit = 6_500_000;
    }

    function notifyBalanceUpdate(address _account, uint256 _amount, bool _increased) public  {
        require(hasCharity(msg.sender), 'iHelp/not-alloweds');
        if(_increased) {
            _contributionsSum[_account] += _amount;
            uniqueContributors.add(_account);
        } else {
            if(_contributionsSum[_account] > _amount) {
                _contributionsSum[_account] -= _amount;
            } else {
                 _contributionsSum[_account] = 0;
                uniqueContributors.remove(_account);
            }
        }
    }

    /**
     * Returns the total number of unique contributrs across all charities
     */
    function numberOfContributors() public view returns (uint256) {
        return uniqueContributors.length();
    }

    /**
    * Returns the contributor address 
    */
    function contributorAt(uint256 _index) public view returns(address) {
        return uniqueContributors.at(_index);
    }

    function tokenPhase() public view returns (uint256) {
        return __tokenPhase;
    }

    function interestGenerated() public view returns (uint256) {
        return __interestGenerated;
    }

    function tokensMintedPerPhase() public view returns (uint256) {
        return __tokensMintedPerPhase;
    }

    function currentTokensPerInterest() public view returns (uint256) {
        return tokensPerInterestByPhase[__tokenPhase];
    }

    function interestPerTokenByPhase(uint256 phase) public view returns (uint256) {
        return cumulativeInterestByPhase[phase].div(__tokensMintedPerPhase);
    }

    function setTokenPhase(uint256 phase) public onlyOperatorOrOwner returns (uint256) {
        console.log("setting token phase", phase);
        __tokenPhase = phase;
        return __tokenPhase;
    }

    function bulkRegisterCharityPools(address[] memory _addresses) public onlyOperatorOrOwner {
        for (uint i = 0; i < _addresses.length; i++) {
            _registerCharityPool(_addresses[i]);
        }
    }

    function registerCharityPool(address _addr) public onlyOperatorOrOwner returns (address) {
       return _registerCharityPool(_addr);
    }

    function _registerCharityPool(address _addr) internal returns (address) {
        require(_addr != address(0), "Charity pool cannot be null");
        console.log("Registering Charity:", _addr);
        charityPoolList.add(_addr);
        return _addr;
    }

    function numberOfCharities() public view returns (uint256) {
        return charityPoolList.length();
    }

    function charityAt(uint256 index) public view returns (address) {
        return charityPoolList.at(index);
    }

    function getCharities() public view returns (address[] memory) {
        return charityPoolList.values();
    }

    function deregisterCharityPool(address _addr) public onlyOperatorOrOwner {
        console.log("removing charity from lists", _addr);
        // remove the address from the charityPoolList
        charityPoolList.remove(_addr);
    }

    function getTotalCharityPoolInterest() external view returns (uint256) {
        uint256 totalInterest = 0;
        PriceFeedProviderInterface.DonationCurrency[] memory cTokens = priceFeedProvider.getAllDonationCurrencies();
        for (uint256 i = 0; i < charityPoolList.length(); i++) {
            address charity = charityPoolList.at(i);
            for (uint256 ii = 0; ii < cTokens.length; ii++) {
                totalInterest += CharityPoolInterface(payable(charity)).totalInterestEarned(cTokens[ii].lendingAddress);
            }
        }
        return totalInterest;
    }

    /**
     * @notice Redeems any newly generated interest and distributes the corrsponding iHelp Tokens
     */
    function upkeep() external onlyOperatorOrOwner {
        PriceFeedProviderInterface.DonationCurrency[] memory cTokens = priceFeedProvider.getAllDonationCurrencies();

        uint256 totalInterest;
        for (uint256 i = 0; i < cTokens.length; i++) {
            totalInterest += contributionsAggregator.redeemInterest(cTokens[i].lendingAddress);
        }

        uint256 tokensToCirculate = drip(totalInterest);
        contributionsAggregator.distributeIHelp(tokensToCirculate);
        totalContributorGeneratedInterest += totalInterest;
        
        // increment the interest counter in the charities
        incrementTotalInterest();

        emit RedeemedInterest(totalInterest, tokensToCirculate);
    }

    /**
     * @notice Redeems any newly generated interest and distributes the corrsponding iHelp Tokens
     */
    function incrementTotalInterest() public onlyOperatorOrOwner {
        for (uint256 i = 0; i < charityPoolList.length(); i++) {
            address charity = charityPoolList.at(i);
            CharityPoolInterface charityInstance = CharityPoolInterface(payable(charity));
            if (charityInstance.accountedBalanceUSD() > 0) {
                charityInstance.incrementTotalInterest();
            }
        }
    }

    /**
     * Drips iHelp tokens accodring to to the total charity pool contributions and interest
     * @param _interest - The newly generate interest
     * @return the new tokens to circulate 
     */
    function drip(uint256 _interest) internal  virtual returns(uint256)  {
        // based on the total generated interest in the timestep generate the tokens to drip
        uint256 tokensPerInterest = tokensPerInterestByPhase[__tokenPhase];
        // e.g. $1.66 in Wei
        console.log("tokensPerInterest", tokensPerInterest);
        console.log("interest", _interest);

        // calculate the units to drip this timestamp

        uint256 tokensToCirculate = (_interest * tokensPerInterest) / 10 ** underlyingToken.decimals();
        // 1.66 * 10 = 16.66 tokens to circulate (in ihelp currency)

        console.log("totalSupply", __totalSupply);
        console.log("tokensToCirculate", tokensToCirculate,  underlyingToken.decimals());

        uint256 tokensToCirculateInCurrentPhase;

        if (tokensToCirculate >= __totalSupply) {

            tokensToCirculateInCurrentPhase = __totalSupply;

            console.log("");
            console.log("splitting interest division...");

            console.log("tokensToCirculateInCurrentPhase", tokensToCirculateInCurrentPhase);

            __totalSupply = 0;
            __totalCirculating += tokensToCirculateInCurrentPhase;

            console.log("tokensPerInterest", tokensPerInterest);

            uint256 interestForExistingTokenSupply = (tokensToCirculateInCurrentPhase / tokensPerInterest) * 10 ** underlyingToken.decimals();

            console.log("interestForExistingTokenSupply", interestForExistingTokenSupply);

            // DISTRIBUTE THIS INTEREST TO ALL

            uint256 remainingInterestToCirculate = _interest - interestForExistingTokenSupply;
            // e.g. $10 required - $6 ciruclated = $4 remaining
            console.log("remainingInterestToCirculate", remainingInterestToCirculate);

            __tokenPhase += 1;
            uint256 newTokensPerInterest = tokensPerInterestByPhase[__tokenPhase];

            // e.g. 0.86

            // mint another 1,000,000 tokens to the supply
            // console.log('mint operator',operator);
            _mint(operator, __tokensMintedPerPhase * 1e18);

            __totalSupply += __tokensMintedPerPhase * 1e18;

            console.log("newTokensPerInterest", newTokensPerInterest);

            uint256 remainingTokensToCirculate = (remainingInterestToCirculate * newTokensPerInterest) / 10 ** underlyingToken.decimals();
            // e..g $4 * $0.86 = $3.44
            console.log("remainingTokensToCirculate", remainingTokensToCirculate);

            tokensToCirculate = remainingTokensToCirculate;

            emit PhaseChange(__tokenPhase, tokensToCirculateInCurrentPhase, remainingTokensToCirculate);

        }

        __totalSupply -= tokensToCirculate;
        __totalCirculating += tokensToCirculate;
        __tokensLastDripped = tokensToCirculate + tokensToCirculateInCurrentPhase;

        console.log("__tokensLastDripped", __tokensLastDripped);

        return __tokensLastDripped;
    }

    /**
     * Check of a certain charity was registered with the system
     */
    function hasCharity(address _addr) public view returns (bool) {
        return charityPoolList.contains(_addr);
    }

    function setFees(
        uint256 _dev,
        uint256 _stake,
        uint256 _charity
    ) public onlyOperatorOrOwner {
        require(_dev + _stake + _charity <= 1000, "Invalid fees");
        developmentShareOfInterest = _dev;
        stakingShareOfInterest = _stake;
        charityShareOfInterest = _charity;
    }

    function getFees()
        public
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return (developmentShareOfInterest, stakingShareOfInterest, charityShareOfInterest);
    }
    
    function setDirectDonationFees(
        uint256 _dev,
        uint256 _stake,
        uint256 _charity
    ) public onlyOperatorOrOwner {
        require(_dev + _stake + _charity <= 1000, "Invalid fees");
        directDonationDevelopmentShareOfInterest = _dev;
        directDonationStakingShareOfInterest = _stake;
        directDonationCharityShareOfInterest = _charity;
    }

    function getDirectDonationFees()
        public
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return (directDonationDevelopmentShareOfInterest, directDonationStakingShareOfInterest, directDonationCharityShareOfInterest);
    }

    function totalCirculating() public view returns (uint256) {
        return __totalCirculating;
    }

    function totalAvailableSupply() public view returns (uint256) {
        return __totalSupply;
    }

    function tokensLastDripped() public view returns (uint256) {
        return __tokensLastDripped;
    }

    function claimableTokens() public view returns (uint256) {
        return getClaimableTokens(msg.sender);
    }

    function getClaimableTokens(address _addr) public view returns (uint256) {
        return contributionsAggregator.claimableIHelpRewardOf(_addr);
    }

    function balance() public view returns (uint256) {
        return balanceOf(msg.sender);
    }

    function claimTokens() public {
        uint256 claimAmount = getClaimableTokens(msg.sender);
        claimSpecificTokens(claimAmount);
    }

    function claimSpecificTokens(uint256 amount) public {
        contributionsAggregator.claimIHelpReward(msg.sender, amount);
        _transfer(operator, msg.sender, amount);
    }

    /**
        Performs a bulk withdrawals on the given charities
     */
    function withdrawBulk(address[] calldata _charities) external {
        for (uint256 i = 0; i < _charities.length; i++) {
            CharityPoolInterface(_charities[i]).withdrawAll(msg.sender);
        }
    }

    // getters used for iHelp interface definition
    function getUnderlyingToken() public view returns (IERC20) {
        return underlyingToken;
    }

    function getPools() public view returns (address, address) {
        return (developmentPool, stakingPool);
    }

    function setStakingPool(address _poolAddress) external onlyOperatorOrOwner {
        stakingPool = _poolAddress;
    }

    function setDevelopmentPool(address _poolAddress) external onlyOperatorOrOwner {
        developmentPool = _poolAddress;
    }

    function setContributionsAggregator(address _aggregatorAddress) external onlyOperatorOrOwner {
        contributionsAggregator = ContributionsAggregator(_aggregatorAddress);
    }
}
