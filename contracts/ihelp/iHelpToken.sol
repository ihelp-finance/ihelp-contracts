// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import {PRBMathUD60x18} from "@prb/math/contracts/PRBMathUD60x18.sol";

import "../utils/IERC20.sol";

import "./CharityPool.sol";

import "hardhat/console.sol";

contract iHelpToken is ERC20CappedUpgradeable, OwnableUpgradeable {
    using PRBMathUD60x18 for uint256;

    address public operator;
    address public stakingPool;
    address public developmentPool;
    address public holdingPool;

    IERC20 public underlyingToken;
    uint256 public __totalCirculating;
    uint256 public __totalSupply;
    uint256 public __tokenPhase;
    uint256 public __interestGenerated;
    uint256 public __tokensLastDripped;
    uint256 public __tokensMintedPerPhase;
    uint256 public __lastProcessedInterestUSD;
    mapping(uint => uint256) public __tokensPerInterestByPhase;
    mapping(uint => uint256) public __cumulativeInterestByPhase;
    mapping(address => uint256) public charityPoolContributions;
    mapping(address => address[]) public charityPoolContributors;
    mapping(address => uint256) public contributorTokenClaims;
    mapping(address => uint256) public charityInterestShare;
    mapping(address => uint256) public claimableCharityInterest;
    uint256 public developmentShareOfInterest;
    uint256 public stakingShareOfInterest;
    uint256 public charityShareOfInterest;

    // map the charity pool address to the underlying token
    mapping(address => CharityPool) internal __charityPoolRegistry;

    address[] public charityPoolList;

    function setTokenPhases() internal {

        uint numberPhases = 20;

        uint lastInterest = 600000;
        uint cumulativeInterest = 0;
        uint lastCumulative = 0;

        for (uint phase = 1; phase <= numberPhases; phase++) {

            if (phase == 1) {
                lastInterest = lastInterest;
            }
            else {
                lastInterest = lastInterest * 2;
            }

            cumulativeInterest += lastInterest;
            __cumulativeInterestByPhase[phase] = cumulativeInterest;
            __tokensPerInterestByPhase[phase] = __tokensMintedPerPhase.div(cumulativeInterest - lastCumulative);

            lastCumulative = cumulativeInterest;

        }

    }
    
    function transferOperator(address newOperator) public virtual onlyOperatorOrOwner {
        require(newOperator != address(0), "Ownable: new operator is the zero address");
        _transferOperator(newOperator);
    }
    
    function _transferOperator(address newOperator) internal virtual {
        address oldOperator = operator;
        operator = newOperator;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Funding/is-operator");
        _;
    }

    modifier onlyOperatorOrOwner() {
        require(msg.sender == operator || msg.sender == owner(), "Funding/is-operator-or-owner");
        _;
    }

    function postUpgrade() external {
        
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        address _operator,
        address _stakingPool,
        address _developmentPool,
        address _holdingPool,
        address _underlyingToken
    ) public initializer {
        
        __ERC20_init(_name, _symbol);
        __ERC20Capped_init_unchained(20000000 * 1000000000000000000);
        __Ownable_init();
        
        operator = _operator;
        stakingPool = _stakingPool;
        developmentPool = _developmentPool;
        holdingPool = _holdingPool;
        underlyingToken = IERC20(_underlyingToken);

        __tokensMintedPerPhase = 1000000;
        
        // scale these later in the contract based on the charity pool decicals
        developmentShareOfInterest = 0.05 * 1000000000000000000;
        stakingShareOfInterest = 0.15 * 1000000000000000000;
        charityShareOfInterest = 0.80 * 1000000000000000000;

        __totalSupply = __tokensMintedPerPhase * 1000000000000000000;
        __totalCirculating = 0;

        __tokenPhase = 1;

        __lastProcessedInterestUSD = 0;
        __tokensLastDripped = 0;

        setTokenPhases();
        
        // mint the initial HELP phase and premine tokens
        _mint(operator, __tokensMintedPerPhase * 1000000000000000000);
        
        uint256 premineTokens = 7000000;
        _mint(_developmentPool, premineTokens * 1000000000000000000);
        
    }
    
    function tokenPhase() public view returns(uint256) {
        return __tokenPhase;
    }

    function interestGenerated() public view returns(uint256) {
        return __interestGenerated;
    }

    function tokensMintedPerPhase() public view returns(uint256) {
        return __tokensMintedPerPhase;
    }

    function currentTokensPerInterest() public view returns(uint256) {
        return __tokensPerInterestByPhase[__tokenPhase];
    }

    function tokensPerInterestByPhase(uint phase) public view returns(uint256) {
        return __tokensPerInterestByPhase[phase];
    }

    function interestPerTokenByPhase(uint phase) public view returns(uint256) {
        return __cumulativeInterestByPhase[phase].div(__tokensMintedPerPhase);
    }

    function setTokenPhase(uint phase) public onlyOperatorOrOwner returns(uint) {
        console.log('setting token phase', phase);
        __tokenPhase = phase;
        return __tokenPhase;
    }

    function registerCharityPool(address _addr) public onlyOperatorOrOwner returns(address) {
        if (charityPoolInRegistry(_addr) != _addr) {
            console.log('adding charity...');
            __charityPoolRegistry[_addr] = CharityPool(_addr);
            charityPoolList.push(_addr);
        }
        else {
            console.log('charity already added...');
        }
        return address(__charityPoolRegistry[_addr]);
    }

    function charityPoolInRegistry(address _addr) public view returns(address) {
        console.log('checking if in registry:', _addr, address(__charityPoolRegistry[_addr]));
        return address(__charityPoolRegistry[_addr]);
    }

    function numberOfCharities() public view returns(uint) {
        return charityPoolList.length;
    }

    function find(address _addr) internal returns(uint) {
        uint i = 0;
        while (charityPoolList[i] != _addr) {
            if (i<charityPoolList.length-1){ 
                i++;
            } else {
                i=charityPoolList.length;
                break;
            }
        }
        return i;
    }

    function removeByIndex(uint i) internal {
        while (i<charityPoolList.length-1) {
            charityPoolList[i] = charityPoolList[i+1];
            i++;
        }
        charityPoolList.pop();
    }
    
    function removeCharityByAddress(address _addr) internal {
        uint i = find(_addr);
        if (i < charityPoolList.length) {
            removeByIndex(i);
        }
    }

    function deregisterCharityPool(address _addr) public onlyOperatorOrOwner {
        console.log('removing charity from lists',_addr);
        delete __charityPoolRegistry[_addr];
        // remove the address from the charityPoolList
        removeCharityByAddress(_addr);
    }

    function getTotalCharityPoolInterest() external view returns(uint256) {
        uint256 totalInterest = 0;
        for (uint i = 0; i < charityPoolList.length; i++) {
            totalInterest += __charityPoolRegistry[charityPoolList[i]].totalInterestEarned();
        }
        return totalInterest;
    }
    
    // drip ihelp tokens based on interest generated across all charities
    function drip() public onlyOperatorOrOwner returns(uint256) {
        
        console.log('DRIPPING...\n');

        // CHECKS, EFFECTS, INTERACTIONS

        // make sure this only happens once per block - for now just made it on demand

        // this value will accumulate the overall accumlated interest balance for each charity over each timestep
        uint256 newInterestUSD = 0; // represents capital contributed + interest generated

        uint256 totalCharityPoolContributions = 0;

        // the number of tokens that go to each user is based on their currently allocated capital across all pools
        
        console.log('calculating incremental charity pool interest generation...');

        for (uint i = 0; i < charityPoolList.length; i++) {

            console.log('');
            console.log(charityPoolList[i]);

            string memory charityToken = __charityPoolRegistry[charityPoolList[i]].tokenname();

            // get the total from each charity - this represents an accumulated value not just the current capital or interest
            __charityPoolRegistry[charityPoolList[i]].calculateTotalIncrementalInterest();
            
            uint256 totalInterestUSDofCharity = __charityPoolRegistry[charityPoolList[i]].newTotalInterestEarnedUSD();
            
            // capture the share
            charityInterestShare[charityPoolList[i]] += totalInterestUSDofCharity;    
            
            // this represents the totalInterest in USD
            newInterestUSD += totalInterestUSDofCharity;

            // get the balance per user that has generated this new interest amount
            uint256 charityAccountedBalance = __charityPoolRegistry[charityPoolList[i]].accountedBalanceUSD();

            totalCharityPoolContributions += charityAccountedBalance;
            charityPoolContributions[charityPoolList[i]] = charityAccountedBalance;
            charityPoolContributors[charityPoolList[i]] = __charityPoolRegistry[charityPoolList[i]].getContributors();

        }

        // keep track of the last interest processed so we only processed the changed aggregate interest amount
        console.log('\nincremental calc done...');
        console.log('\nnewInterestUSD', newInterestUSD);

        __interestGenerated += newInterestUSD;

        // based on the total generated interest in the timestep generate the tokens to drip
        uint256 tokensPerInterest = tokensPerInterestByPhase(__tokenPhase);
        // e.g. $1.66 in Wei
        console.log('tokensPerInterest', tokensPerInterest);

        // calculate the units to drip this timestamp
        uint256 tokensToCirculate = newInterestUSD.mul(tokensPerInterest);
        // 1.66 * 10 = 16.66 tokens to circulate (in ihelp currency)

        console.log('totalSupply', __totalSupply);
        console.log('tokensToCirculate', tokensToCirculate);

        // check supply and only only process what is available, mint more if needed at next rate
        // e.g. 10 tokens available - 16.66 tokens needed = -6.66 tokens remaining
        // if newTokenSupply is <= 0, circulate tokens at the current phase rate and mint new ones
        // for this changeover case, we basically need to only generate enough tokens in supply and back out the interest used for that
        // then calculate the new token generation based on the new token interest rate

        uint256 tokensToCirculateInCurrentPhase = 0;

        if (tokensToCirculate >= __totalSupply) {

            console.log('');
            console.log('splitting interest division...');

            tokensToCirculateInCurrentPhase = __totalSupply;
            // e.g. 10 tokens

            __totalSupply -= tokensToCirculateInCurrentPhase;
            __totalCirculating += tokensToCirculateInCurrentPhase;

            // now that we are circulating new tokens we must immediate assign the current unassigned circulating tokens to contributors
            if (totalCharityPoolContributions > 0) {
                for (uint i = 0; i < charityPoolList.length; i++) {

                    console.log('');
                    console.log('pool:', charityPoolList[i]);

                    uint256 poolContribution = charityPoolContributions[charityPoolList[i]];
                    console.log('poolContribution', poolContribution);

                    if (poolContribution > 0) {

                        uint256 poolShare = poolContribution.div(totalCharityPoolContributions);
                        console.log('poolShare', poolShare);

                        uint256 poolTokens = poolShare.mul(tokensToCirculateInCurrentPhase);
                        console.log('poolTokens', poolTokens);

                        address[] memory contributorList = charityPoolContributors[charityPoolList[i]];

                        for (uint ii = 0; ii < contributorList.length; ii++) {

                            // get the contributors balance
                            uint256 userContribution = __charityPoolRegistry[charityPoolList[i]].balanceOfUSD(contributorList[ii]);

                            uint256 userShare = userContribution.div(poolContribution);
                            console.log('contributor', contributorList[ii], userContribution, userShare);

                            uint256 contribTokens = userShare.mul(poolTokens);
                            console.log('contribTokens', contribTokens);

                            contributorTokenClaims[contributorList[ii]] += contribTokens;

                        }

                    }

                }

            }

            uint interestForExistingTokenSupply = tokensToCirculateInCurrentPhase.div(tokensPerInterest);

            console.log('interestForExistingTokenSupply', interestForExistingTokenSupply);

            // DISTRIBUTE THIS INTEREST TO ALL

            console.log('newInterestUSD', newInterestUSD);

            uint remainingInterestToCirculate = newInterestUSD - interestForExistingTokenSupply;
            // e.g. $10 required - $6 ciruclated = $4 remaining
            console.log('remainingInterestToCirculate', remainingInterestToCirculate);

            __tokenPhase += 1;
            uint256 newTokensPerInterest = tokensPerInterestByPhase(__tokenPhase);
            // e.g. 0.86

            // mint another 1,000,000 tokens to the supply
            // console.log('mint operator',operator);
            _mint(operator, __tokensMintedPerPhase * 1000000000000000000);

            __totalSupply += __tokensMintedPerPhase * 1000000000000000000;

            uint256 remainingTokensToCirculate = remainingInterestToCirculate.mul(newTokensPerInterest);
            // e..g $4 * $0.86 = $3.44

            tokensToCirculate = remainingTokensToCirculate;

        }

        // there is enough supply in balance so don't have to mint a new phase
        __totalSupply -= tokensToCirculate;
        __totalCirculating += tokensToCirculate;

        // now that we are circulating new tokens we must immediate assign these to users

        // get the total balances
        console.log('');
        console.log('totalCharityPoolContributions', totalCharityPoolContributions);

        if (totalCharityPoolContributions > 0) {
            for (uint i = 0; i < charityPoolList.length; i++) {

                console.log('');
                console.log('pool:', charityPoolList[i]);

                uint256 poolContribution = charityPoolContributions[charityPoolList[i]];
                console.log('poolContribution', poolContribution);

                if (poolContribution > 0) {

                    uint256 poolShare = poolContribution.div(totalCharityPoolContributions);
                    console.log('poolShare', poolShare);

                    uint256 poolTokens = poolShare.mul(tokensToCirculate);
                    console.log('poolTokens', poolTokens);

                    address[] memory contributorList = charityPoolContributors[charityPoolList[i]];

                    for (uint ii = 0; ii < contributorList.length; ii++) {

                        // get the contributors balance
                        uint256 userContribution = __charityPoolRegistry[charityPoolList[i]].balanceOfUSD(contributorList[ii]);

                        uint256 userShare = userContribution.div(poolContribution);
                        console.log('contributor', contributorList[ii], userContribution, userShare);

                        uint256 contribTokens = userShare.mul(poolTokens);
                        console.log('contribTokens', contribTokens);

                        contributorTokenClaims[contributorList[ii]] += contribTokens;

                    }

                }

            }

        }

        __tokensLastDripped = tokensToCirculate + tokensToCirculateInCurrentPhase;

        return tokensToCirculate;

    }

    // incremental dump of interest
    // development pool
    // staking pool
    // charity interest pool
    function dump() public onlyOperatorOrOwner returns(uint256) {

        // keep track of incremental amounts

        // check the incrementals add up to the total specific charity amounts
        console.log('\ndumping interest...\n');

        // incrementalDevelopmentInterest;
        // incrementalStakingInterest;
        // incrementalCharityInterest

        uint256 perfectRedeemedInterest = 0;
        for (uint i = 0; i < charityPoolList.length; i++) {
            perfectRedeemedInterest += charityInterestShare[charityPoolList[i]];
        }
        console.log('perfectRedeemedInterest', perfectRedeemedInterest);

        if (perfectRedeemedInterest > 0) {

            for (uint i = 0; i < charityPoolList.length; i++) {

                // get the balance of the holding pool before and after the redemption
                uint256 tokenBalanceBefore = underlyingToken.balanceOf(holdingPool);

                // redeem the charity interest to the holding pool
                console.log('\nREDEEM START');
                console.log(charityPoolList[i]);
                __charityPoolRegistry[charityPoolList[i]].redeemInterest();
                console.log('REDEEM END\n');

                uint256 tokenBalanceAfter = underlyingToken.balanceOf(holdingPool);

                // this gets the actual interest generated after the swap
                if (tokenBalanceAfter > tokenBalanceBefore) {

                    uint256 realRedeemedInterest = tokenBalanceAfter - tokenBalanceBefore;

                    console.log('perfectRedeemedInterest,realRedeemedInterest');
                    console.log(charityInterestShare[charityPoolList[i]], realRedeemedInterest);

                    uint256 differenceInInterest = realRedeemedInterest.div(charityInterestShare[charityPoolList[i]]);
                    console.log('differenceInInterest', differenceInInterest);

                    // make the redeem interest portion available to the charity
                    address charityWalletAddress = __charityPoolRegistry[charityPoolList[i]].charityWallet();

                    uint256 correctedInterestShare = charityInterestShare[charityPoolList[i]].mul(differenceInInterest);
                    console.log('correctedInterestShare', correctedInterestShare);

                    // divide this amongst holding, dev and staking pools (and charities)
                    
                    // if the charity wallet address is equal to the holding pool address, this is an off-chain transfer to assign it to the charity contract itself
                    if (charityWalletAddress == holdingPool) {
                        claimableCharityInterest[charityPoolList[i]] += correctedInterestShare.mul(charityShareOfInterest);
                    } else {
                        claimableCharityInterest[charityWalletAddress] += correctedInterestShare.mul(charityShareOfInterest);
                    }
                    claimableCharityInterest[developmentPool] += correctedInterestShare.mul(developmentShareOfInterest);
                    claimableCharityInterest[stakingPool] += correctedInterestShare.mul(stakingShareOfInterest);

                    // reset the charity interest share
                    charityInterestShare[charityPoolList[i]] = 0;

                }
                else {
                    console.log('NO CHANGE IN DUMPED STATE.');
                }

            }
        }

    }

    function totalCirculating() public view returns(uint256) {
        return __totalCirculating;
    }

    function totalAvailableSupply() public view returns(uint256) {
        return __totalSupply;
    }

    function tokensLastDripped() public view returns(uint256) {
        return __tokensLastDripped;
    }

    function claimableTokens() public view returns(uint256) {
        return contributorTokenClaims[msg.sender];
    }

    function getClaimableTokens(address _addr) public view returns(uint256) {
        return contributorTokenClaims[_addr];
    }

    function getClaimableCharityInterestOf(address _addr) public view returns(uint256) {
        return claimableCharityInterest[_addr];
    }

    function getClaimableCharityInterest() public view returns(uint256) {
        return claimableCharityInterest[msg.sender];
    }

    function isCharityAddress(address _addr) public view returns (bool){
         bool charityAddress = false;
         for (uint i = 0; i < charityPoolList.length; i++) {
             if (charityPoolList[i] == _addr) {
                 charityAddress = true;
                 break;
             }
         }
         return charityAddress;
    }

    // must send from holdingPool account
    function claimInterest(address payable _addr) public {

        console.log('CLAIMING INTEREST');
        console.log(msg.sender, holdingPool, _addr);
        
        if ( isCharityAddress(_addr) || holdingPool == _addr) {
            
            console.log('off-chain transfer to charity wallet - not touching anything');
            
        } else {

            if (msg.sender == holdingPool) {
    
                uint256 amount = claimableCharityInterest[_addr];
    
                if (amount > 0) {
    
                    // charityPool account
                    uint bal = underlyingToken.balanceOf(msg.sender);
                    console.log('balance of sender:', bal);
                    
                    claimableCharityInterest[_addr] = 0;
    
                    bool success = underlyingToken.transferFrom(msg.sender, _addr, amount);
                    require(success, "transfer failed");

                }
            }
        
        }
    }
    
    function resetClaimableCharityInterest(address _addr) public onlyOperatorOrOwner {
        claimableCharityInterest[_addr] = 0;
    }

    function claimTokens() public {

        uint256 claimAmount = contributorTokenClaims[msg.sender];

        console.log('claiming tokens', msg.sender, claimAmount);
        console.log('total tokens', operator, balanceOf(operator));

        contributorTokenClaims[msg.sender] -= claimAmount;

        approve(operator, claimAmount);
        _transfer(operator, msg.sender, claimAmount);

    }
    
    function claimSpecificTokens(uint256 amount) public {

        uint256 claimAmount = contributorTokenClaims[msg.sender];
        
        require(claimAmount >= amount,'not enough claimable balance for amount');

        console.log('claiming tokens', msg.sender, amount);

        contributorTokenClaims[msg.sender] -= amount;

        approve(operator, amount);
        _transfer(operator, msg.sender, amount);

    }

    function balance() public view returns(uint256) {
        return balanceOf(msg.sender);
    }
    
    function getUnderlyingToken() public view returns(IERC20) {
        return underlyingToken;
    }
    
    function getStakingPool() public view returns(address) {
        return stakingPool;
    }
    
    function getHoldingPool() public view returns(address) {
        return holdingPool;
    }

}
