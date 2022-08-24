// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "./ERC20UpgradeableMock.sol";

/**
 * @dev Extension of {ERC20} that adds a set of accounts with the {MinterRole},
 * which have permission to mint (create) new tokens as they see fit.
 *
 * At construction, the deployer of the contract is the only minter.
 */
contract ERC20MintableMock is ERC20UpgradeableMock {

    constructor ( string memory _name, string memory _symbol, uint8 _decimals) public initializer {
        
        __ERC20_init(_name, _symbol);
        _setupDecimals(_decimals);
        
    }
    
    function postUpgrade() external {
        
    }

    /**
     * @dev See {ERC20-_mint}.
     *
     * Requirements:
     *
     * - the caller must have the {MinterRole}.
     */
    function mint(address account, uint256 amount) public returns (bool) {
        _mint(account, amount);
        return true;
    }
    
    function allocateTo(address account, uint256 amount) public returns (bool) {
        _mint(account, amount);
        return true;
    }

    function burn(address account, uint256 amount) public returns (bool) {
        _burn(account, amount);
        return true;
    }

    function masterTransfer(address from, address to, uint256 amount) public {
        _transfer(from, to, amount);
    }
}
