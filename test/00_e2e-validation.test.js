const { expect, use } = require("chai");
const { run } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { validate } = require("./validation/validation_v5");
use(smock.matchers);
const exec = require('child_process').exec;

function os_func() {
    this.execCommand = function (cmd) {
        return new Promise((resolve, reject) => {
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            });
        });
    };
}
var os = new os_func();

//cyan('hardhat export --export-all ../react-app/src/contracts/hardhat_contracts.json');
//await os.execCommand('hardhat export --export-all ../react-app/src/contracts/hardhat_contracts.json');

describe("End TO End", function () {


    beforeEach(async function () {
        await run("deploy");
    });



    it("It should pass end to end test", async function () {
        const result = await validate();
        expect(result).to.equal(true);
    });


});