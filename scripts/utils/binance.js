const { default: Axios } = require('axios')
const { createHmac } = require('crypto');

const binanceClient = (apiKey, secret) => {
    const client = Axios.create({
        baseURL: 'https://api.binance.us',
        headers: {
            'X-MBX-APIKEY': apiKey,
        },
    })

    const generateSignature = (data) => {
        const hash = createHmac("sha256", secret)
            .update(data)
            .digest('hex');
        return hash;
    }


    const getDepositWallet = async (coin, network) => {
        return request('get', '/sapi/v1/capital/deposit/address', {
            coin,
            network,
        })
    }

    const getRecentDeposits = async (coin, network, offset = 0, limt = 100) => {
        return request('get', '/sapi/v1/capital/deposit/hisrec', {
            coin,
            network,
        }
    }

    /**
     * Wait for a certain depoit to arrive on binance and return it
     * @param {string} txid - The txid of the deposit
     * @param {string} coin - The token of the deposit
     * @param {string} network  - The netwotk of the deposit
     * @param {integer} secounds  - Minutes to wait for this deposit
     */
    const waitForDeposit = async (txid, coin, network, secounds) => {
        const startTime = Date.now();
        let deposit
        async function wait() {
            const deposits = await getRecentDeposits(coin, network, 0, 1000);
            deposit = deposits.find(item => item.txid === txid);

            if (deposit) {
                return deposit;
            }
            const secoundsPassed = Date.now() - startTime;
            if (secoundsPassed >= secounds) {
                return;
            }

            // Wait 15 secounds and retry
            setTimeout(() => await wait(), 15 * 1000)
        }

        await wait();
        return deposit;
    }

    const transferToBankAccount = async (paymentAccount, amount) => {
        return request('post', '/sapi/v1/fiatpayment/apply/withdraw', {
            paymentAccount,
            amount
        })
    }

    const createMarketOrder = async (quantity, symbold, side) => {
        return request('post', '/api/v3/order', {
            symbold,
            quantity,
            type: "MARKET"
        })
    }

    const request = (method, path, data) => {
        const dataString = JSON.stringify(data);
        const signature = generateSignature(dataString)
        return client.request({
            method,
            url: path,
            data: {
                ...data,
                signature,
                timestamp: Date.now()
            }
        })
            .then(response => response.data)
            .catch(err => {
                console.error(err);
            })
    }

    return { request, createMarketOrder, transferToBankAccount, getDepositWallet, getRecentDeposits, waitForDeposit };
}

module.exports = {
    binanceClient
}