#!/bin/bash

rundir="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

cd $rundir

source ../.env

echo RUNNING UPKEEP $(date) > UPKEEP.log 2>&1
echo "" >> UPKEEP.log

timeout 600s /usr/local/bin/node UPKEEP.js >> UPKEEP.log 2>&1
ec=$?

echo "ec: $ec" >> UPKEEP.log

if [[ "$ec" == "0" ]]; then
    curl "$UPKEEP_UPTIME_URL" >> UPKEEP.log 2>&1
else
    echo "" >> UPKEEP.log
    echo "job failed - not submitting uptime monitor" >> UPKEEP.log
fi

exit $ec
