#!/bin/bash

rundir="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

cd $rundir

source ../../env/.env

echo RUNNING REWARD $(date) > /logs/REWARD.log 2>&1
echo "" >> /logs/REWARD.log

timeout 600s /usr/local/bin/node REWARD.js >> /logs/REWARD.log 2>&1
ec=$?

echo "ec: $ec" >> REWARD.log

if [[ "$ec" == "0" ]]; then
    curl "$REWARD_UPTIME_URL" >> /logs/REWARD.log 2>&1
else
    echo "" >> /logs/REWARD.log
    echo "job failed - not submitting uptime monitor" >> /logs/REWARD.log
fi

exit $ec
