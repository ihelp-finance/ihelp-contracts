#!/bin/bash

chainToMock="$1"

if [ $# -lt 1 ]; then
    echo "Please provide network name to mock (deployments must already exist)..."
    exit 1
fi 

echo $PWD

rm build/localhost_* build/hardhat_* deployments/localhost -Rf

cp build/${chainToMock}_contracts.json build/localhost_contracts.json
cp build/${chainToMock}_charities.json build/localhost_charities.json

cp deployments/$chainToMock deployments/localhost -Rf

echo "31337" > deployments/localhost/.chainId

npx hardhat node --max-memory 8096 --no-deploy --no-reset --network hardhat  --hostname 0.0.0.0 --port 7545
