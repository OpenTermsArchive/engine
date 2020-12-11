#!/bin/bash
export PATH=$PATH:/snap/bin
echo Deploying edit.tosdr.org to tosdr.org
pushd /home/tosdr/edit.tosdr.org
sh db/deploy.sh
popd
echo Done deploying edit.tosdr.org to tosdr.org
