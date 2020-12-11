#!/bin/bash
echo Starting `date` > cron-log.txt 2>&1
bash ./check_quotes.sh >> cron-log.txt 2>&1
bash ./deploy_site.sh >> cron-log.txt 2>&1
echo Done `date` >> cron-log.txt 2>&1
