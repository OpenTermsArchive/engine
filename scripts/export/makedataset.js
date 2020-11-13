import fs from 'fs';
import fse from 'fs-extra';
import mime from 'mime';
import path from 'path';

import Git from '../../src/app/history/git.js';

const git = new Git("../CGUs-versions"); //TODO: make this a CLI argument?

const serviceMap = {
    "AskFM": "ASKfm",
    "GoogleAdMob": "AdMob",
    "GoogleAdSense": "AdSense",
    "AppleAppStore": "App Store",
    "deviantART": "DeviantArt",
    "FacebookAds": "Facebook Ads",
    "FacebookPayments": "Facebook Payments",
    "GoogleAds": "Google Ads",
    "GoogleAnalytics": "Google Analytics",
    "GooglePlayStore": "Google Play",
    "LastFm": "Last.fm",
    "LinguaLeo": "Lingualeo",
    "StackOverflow": "Stack Overflow",
    "WeHeartIt": "We Heart It",
    "WeChatOpenPlatform": "WeChat Open Platform"
};

const doctypeMap = {
  "acceptable_use_policy": "Acceptable Use Policy",
  "brand_guidelines": "Brand Guidelines",
  "commercial_terms": "Commercial Terms",
  "community_guidelines": "Community Guidelines",
  "controller_controller_data_protection_terms": "Data Controller Agreement",
  "cookies_policy": "Trackers Policy",
  "Cookies Policy": "Trackers Policy",
  "copyright_policy": "Copyright Claims Policy",
  "data_processing_terms": "Data Processor Agreement",
  "developer_agreement": "Developer Terms",
  "developer_policy": "Developer Terms",
  "in_app_purchases_policy": "In-App Purchases Policy",
  "law_enforcement_guidelines": "Law Enforcement Guidelines",
  "privacy_policy": "Privacy Policy",
  "review_guidelines": "Review Guidelines",
  "software_license_agreement": "Software License Agreement",
  "terms_of_service": "Terms of Service",
  "terms_of_service_parent_company": "Parent Organization Terms",
  "tos_parent": "Parent Organization Terms",
  "user_consent_policy": "User Consent Policy"
};

const arg = process.argv.filter(el => el.startsWith("--folder-name"))

var exportTarget = "cgus-dataset";
if (arg.length === 1) {
    exportTarget = arg[0].split("=")[1];
}
console.log(`Exporting dataset to ${exportTarget}`)

async function getCommits() {
    return git.log([ '--stat=4096' ])
}

function extractLogInfos(commit) {
    // parse a LogInfo object
    const { hash, date, message, diff } = commit;
    const {files: filesChanged} = diff;
    return { hash, date, message, filesChanged }
}

function makeFilename(target, filepath, date) {
    // given a target folder and a file path, create target dataset structure
    const splitted = filepath.split("/")
    var service = splitted.slice(-2)[0]
    var document_type = splitted.slice(-1)[0].replace(/\.[^/.]+$/, "")

    if (doctypeMap.hasOwnProperty(document_type)) {
        console.log(`Remapping ${document_type} to ${doctypeMap[document_type]}`)
        document_type = doctypeMap[document_type];
    }

    if (serviceMap.hasOwnProperty(service)) {
        console.log(`Remapping ${service} to ${serviceMap[service]}`)
        service = serviceMap[service];
    }

    if (service === "Skype") {
        if (document_type === "undefined") {
            document_type = "Parent Organization Terms";
        }
    }

    const folder = path.join(target, service, document_type)
    return {
        folder: folder,
        file: path.join(folder, date + ".md")
    }
}

function isValidCommit(commitMessage) {
    // util function used for filtering CGUs commits
    const [firstVerb] = commitMessage.split(" ")
    return ["Update", "Start", "Refilter"].includes(firstVerb)
}

async function makeData(commitInfo) {
    // Given info about a specific commit:
    // git checkout on that commit
    await git.checkout(commitInfo.hash);

    // compute target Folder and File Names
    const [file] = commitInfo.filesChanged;
    const filePath = path.join(git.path, file.file);
    const targetFilePath = makeFilename("/tmp/CGUs-extract", filePath, commitInfo.date);

    // create target (temp) folder if needed
    const path_created = fs.mkdirSync(targetFilePath.folder, {recursive: true});
    if (path_created) {
        console.log(`created ${path_created} as it did not exist.`);
    }

    // file options for reading data
    const mimeType = mime.getType(filePath);
    const readFileOptions = {};
    if (mimeType.startsWith('text/')) {
      readFileOptions.encoding = 'utf8';
    }

    // read data from one place and write it to temp location
    const data = fs.readFileSync(filePath, readFileOptions);
    if (data) {
        //console.log(`Read data from ${filePath}`);
        fs.writeFileSync(targetFilePath.file, data);
        //console.log(`Wrote new data to ${targetFilePath.file}`) 
    }
}

async function main() {
    // main function for script
    const commits = await getCommits();

    for (const commit of commits) {

        const commitInfo = extractLogInfos(commit)
        if (!isValidCommit(commitInfo.message)){
            continue
        }

        console.log("Handling commit " + commitInfo.hash.slice(0, 5) + ": " + commitInfo.message)

        if (commitInfo.filesChanged.length > 1) {
            console.warn("More than one file has been changed in this commit.")
            // TODO: handle this case (although it should never happen)
            continue
        }

        await makeData(commitInfo);

    }

    // back to master when done
    git.checkout("master")

    // copy temp dir to final destination
    const final_path = path.join(process.env.PWD, exportTarget)
    fse.copy("/tmp/CGUs-extract/", final_path, function (err) {
        if (err) {
          console.error(err);
        } else {
          console.log(`Dataset is in ${final_path}`);
        }
    });
}

(async function() {
    await main();
}())
