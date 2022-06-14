const ethers = require('ethers');

const EXPECTED_PONG_BACK = 15000
const KEEP_ALIVE_CHECK_INTERVAL = 7500

const Web3LogListener = (nodeUrl, filter) => {
    let start;
    start = (callback, onError) => {
        try {
            let provider = new ethers.providers.WebSocketProvider(nodeUrl)
            let pingTimeout = null
            let keepAliveInterval = null

            provider._websocket.on('open', () => {
                keepAliveInterval = setInterval(() => {
                    console.log('Checking if the connection is alive, sending a ping')

                    provider._websocket.ping()

                    // Use `WebSocket#terminate()`, which immediately destroys the connection,
                    // instead of `WebSocket#close()`, which waits for the close timer.
                    // Delay should be equal to the interval at which your server
                    // sends out pings plus a conservative assumption of the latency.
                    pingTimeout = setTimeout(() => {
                        provider._websocket.terminate()
                    }, EXPECTED_PONG_BACK)
                }, KEEP_ALIVE_CHECK_INTERVAL)
            })

            provider._websocket.on('close', () => {
                console.error('The websocket connection was closed')
                clearInterval(keepAliveInterval)
                clearTimeout(pingTimeout)
                connect()
            })

            provider._websocket.on('pong', () => {
                console.debug('Received pong, so connection is alive, clearing the timeout')
                clearInterval(pingTimeout)
            })

            provider.on(filter, (data) => {
                callback(data);
            })
        } catch (error) {
            console.log(error);
            if (typeof onError === 'function') {
                onError(error);
            } else {
                throw error
            }
        }
    }
    return { start };
}

module.exports = {
    Web3LogListener
};