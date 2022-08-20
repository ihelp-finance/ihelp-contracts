const { updateCharityPoolsDefaultConfig } = require('./deployUtils');
async function main() {
    await updateCharityPoolsDefaultConfig();
    console.log("✅  Updated default charity pool config ");
}

main().then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });