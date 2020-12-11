#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
export PATH=$PATH:/snap/bin
export PSQL_CONNECTION_STRING=`heroku config:get DATABASE_URL --app edit-tosdr-org`
echo Checking Quotes
pushd /home/tosdr/tosback-crawler/
nvm use 12
node src/eto-admin.js 21311 check_quotes
popd
echo Done Checking Quotes
