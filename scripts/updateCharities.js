const { updateCharityPools } = require('./deployUtils');
async function main() {
    await updateCharityPools()
    console.log("✅  Updated contracts ");
}

main().then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });