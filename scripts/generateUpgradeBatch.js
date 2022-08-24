const fs = require('fs');

let logfile = null
if(process.argv.length < 3) {
    // console.log('Trying to use the default deploy.log file generated from yarn deploy ...')   
    logfile = 'deploy.log'
} else {
    logfile = process.argv[2]
}

console.log('\nProcess upgrades for',logfile)

const batch = {
    "version": "1.0",
    "chainId": "43114",
    "meta": { "name": "iHelp Batch Upgrade" },
    "transactions": []
}

const transactionTemplate = {
    "to": "",
    "value": "0",
    "data": "",
}

processLog = async() => {
    
    const content = await fs.readFileSync(logfile,'utf8')
    
    // console.log(content)
    
    var rx = /(?<=to: ).*(?= \(DefaultProxyAdmin)/g;
    const dp = content.match(rx);
    if (dp == null) {
        console.log('no upgrades needed for deployment log');
        process.exit(0)
    }
    const defaultProxyAddress = dp[0];
     
    var rx = /(?<=raw data: ).*(?= )/g;
    const rawDatas = content.match(rx);
    
    console.log('\nUpdating',rawDatas.length,'contracts to',defaultProxyAddress);
    
    rawDatas.map((r)=>{
        
        const newTransaction = JSON.parse(JSON.stringify(transactionTemplate));
        
        newTransaction['to'] = defaultProxyAddress;
        newTransaction['data'] = r;
        
        batch['transactions'].push(newTransaction)
        
    })
    
    const outputFile = 'upgradeBatch.json';
    console.log('\nWriting batch file to',outputFile)
    await fs.writeFileSync(outputFile,JSON.stringify(batch, null, 2))
    console.log('')
    
}

processLog()


