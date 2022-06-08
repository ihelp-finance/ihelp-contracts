const { default: Axios } = require('axios')
const { createHmac } = require('crypto');

const binance = (apiKey, secret) => {
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

    const request = (method, path, data) => {
        const dataString = JSON.stringify(data);
        const signature = generateSignature(dataString)
        return client.request({
            method,
            url: path,
            data: {
                ...data,
                signature
            }
        })
    }

    return request;
}

module.exports = {
    binance
}