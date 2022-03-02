const hardhat = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');
const Big = require('big.js');

use(solidity);

const fromBigNumber = (number) => {
  return parseFloat(web3.utils.fromWei(Big(number).toFixed(0)))
}

describe('iHelp', ()=>{
  
  let signer;
  let ihelp,dai,cdai,charityPool1,charityPool2;
  
  let charityPoolAddress = '0x1291Be112d480055DaFd8a610b7d1e203891C274';

  beforeEach(async () => {
    
    const { deploy } = hardhat.deployments;
    
    let {
      deployer,
      stakingPool,
      developmentPool,
      charity1wallet,
      charity2wallet
    } = await hardhat.getNamedAccounts();

    signer = await hardhat.ethers.provider.getSigner(deployer)
    
    // console.log(`signer: ${signer._address}`)
    
    // get the contracts
    dai = await hardhat.ethers.getContractAt('ERC20Mintable', (await hardhat.deployments.get('Dai')).address, signer)
    cdai = await hardhat.ethers.getContractAt('CTokenMock', (await hardhat.deployments.get('cDai')).address, signer)
    ihelp = await hardhat.ethers.getContractAt('iHelpToken', (await hardhat.deployments.get('iHelp')).address, signer);
    charityPool1 = await hardhat.ethers.getContractAt('CharityPool', (await hardhat.deployments.get('charityPool1')).address, signer);
    charityPool2 = await hardhat.ethers.getContractAt('CharityPool', (await hardhat.deployments.get('charityPool2')).address, signer);
    
  });

  describe('initialize()', () => {
    
    it('Confirm iHelp supply is 1m', async () => {

      let currentSupply = await ihelp.totalSupply();
  
      console.log('currentSupply',fromBigNumber(currentSupply))
      
      expect(currentSupply).to.equal(1000000*1^18);
      
      
    })
  })

});
