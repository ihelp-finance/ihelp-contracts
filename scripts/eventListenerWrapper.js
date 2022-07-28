
const { spawn } = require('child_process');
const path = require('path')

// we run the wrapper with a repeated timeout to account for unreliable websocket connections on event listeners
const timeout = '300s'

const runWrapper = () => {
    
    const cmd = `timeout ${timeout} node eventListener.js`
    
    // console.log(cmd)
    
    const child = spawn(cmd,{
      cwd: path.resolve(__dirname, './'),
      stdio: 'inherit',
      shell: true
    });
    
    child.on('data', (data) => {
      console.log(`\n${data}`);
    });
    
    child.on('exit', function (code, signal) {
        
      //console.log('child process exited with ' + `code ${code} and signal ${signal}`);
      //console.log('all done - restarting event listener')
      
      runWrapper()
      
    });

}

runWrapper()