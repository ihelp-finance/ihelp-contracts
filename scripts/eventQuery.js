const ethers = require('ethers');
const { abi } = require('../artifacts/contracts/ihelp/charitypools/CharityPool.sol/CharityPool.json')

async function getDirectDonactionsBySenders(contractAddress, provider, senderAddresses, fromBlock = 0) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    const filter = contract.filters.DirectDonation(senderAddresses);
    filter.fromBlock = fromBlock;
    const interface = new ethers.utils.Interface(abi);
    return provider.getLogs(filter).then(data => data.map(log => interface.parseLog(log)))
}

module.exports = {
    getDirectDonactionsBySenders
}


