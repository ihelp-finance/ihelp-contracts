#!/bin/bash

if [ $# -lt 1 ]; then
    echo "Please provide network name for deployment (e.g. kovan)..."
    exit 1
fi 

network="$1"

npx hardhat deploy  --network $network  --export-all ./build/${network}_contracts.json
