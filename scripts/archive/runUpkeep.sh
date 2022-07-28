#!/bin/bash

rundir="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

cd $rundir

source ../../env/.env

echo RUNNING UPKEEP $(date) > /logs/UPKEEP.log 2>&1
echo "" >>  /logs/UPKEEP.log

timeout 600s /usr/local/bin/node UPKEEP.js >>  /logs/UPKEEP.log 2>&1
ec=$?

echo "ec: $ec" >> UPKEEP.log

if [[ "$ec" == "0" ]]; then
    curl "$UPKEEP_UPTIME_URL" >>  /logs/UPKEEP.log 2>&1
else
    echo "" >>  /logs/UPKEEP.log
    echo "job failed - not submitting uptime monitor" >>  /logs/UPKEEP.log
fi

exit $ec
