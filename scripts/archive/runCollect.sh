#!/bin/bash

rundir="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

cd $rundir

source ../.env

echo RUNNING COLLECTDATA $(date) > COLLECTDATA.log 2>&1
echo "" >> COLLECTDATA.log

timeout 120s /usr/local/bin/node collectdata.js >> COLLECTDATA.log 2>&1
ec=$?

echo "ec: $ec" >> COLLECTDATA.log

if [[ "$ec" == "0" ]]; then
    curl "$COLLECT_UPTIME_URL" >> COLLECTDATA.log 2>&1
else
    echo "" >> COLLECTDATA.log
    echo "job failed - not submitting uptime monitor" >> COLLECTDATA.log
fi

exit $ec
