#!/bin/bash

rundir="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

cd $rundir

source ../.env

echo RUNNING REWARD $(date) > REWARD.log 2>&1
echo "" >> REWARD.log

timeout 600s /usr/local/bin/node REWARD.js >> REWARD.log 2>&1
ec=$?

echo "ec: $ec" >> REWARD.log

if [[ "$ec" == "0" ]]; then
    curl "$REWARD_UPTIME_URL" >> REWARD.log 2>&1
else
    echo "" >> REWARD.log
    echo "job failed - not submitting uptime monitor" >> REWARD.log
fi

exit $ec
