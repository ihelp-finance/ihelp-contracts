#!/bin/bash

rundir="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

cd $rundir

source ../../env/.env

echo RUNNING LEADERBOARD $(date) > /logs/LEADERBOARD.log 2>&1
echo "" >>  /logs/LEADERBOARD.log

timeout 600s /usr/local/bin/node leaderboard.js >>  /logs/LEADERBOARD.log 2>&1
ec=$?

echo "ec: $ec" >> LEADERBOARD.log

if [[ "$ec" == "0" ]]; then
    #curl "$UPKEEP_UPTIME_URL" >>  /logs/LEADERBOARD.log 2>&1
    echo "success"  >>  /logs/LEADERBOARD.log 2>&1
else
    echo "" >>  /logs/LEADERBOARD.log
    echo "job failed - not submitting uptime monitor" >>  /logs/LEADERBOARD.log
fi

exit $ec
