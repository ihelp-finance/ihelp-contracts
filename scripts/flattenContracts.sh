#!/bin/bash

contractsToFlatten=( "ihelp/iHelpToken" )

flatdir="contracts_flattened"

mkdir -p $flatdir

for contract in "${contractsToFlatten[@]}"
do

cname=$(basename $contract)

npx hardhat flat ./contracts/$contract.sol --output $flatdir/${cname}Flat.sol

done
