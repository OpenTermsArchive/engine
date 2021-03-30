#!/bin/sh

# Build a dataset and release it to GitHub

echo "=============== [1] ==============="
echo "Checking that version database exists"
if [ -d "$1" ]
then
    echo "Directory $1 exists."
else
    echo "Directory $1 does not exists."
    exit 1
fi
echo ""

echo "=============== [2] ==============="
echo "Running export script"
npm run export > last_export.log

DATASET=$(tail -1 last_export.log | grep -oE '[^/]+$')
echo "Dataset: $DATASET"

DATE=$(date +"%Y-%m-%d")
TAG="$DATE-$(echo $DATASET | cut -d "-" -f 5)"
echo "Tag: $TAG"

echo ""

mkdir -p ./data

echo "=============== [3] ==============="
echo "Zipping dataset"
zip -r ./data/${DATASET}.zip ./data/${DATASET}
echo ""

echo "=============== [4] ==============="
echo "Releasing dataset to GitHub"
gh release -R ambanum/OpenTermsArchive-versions create $TAG ./data/${DATASET}.zip -t "$DATE Dump" -n "New dataset release :tada:"
echo ""
