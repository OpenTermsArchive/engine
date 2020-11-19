import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import fse from 'fs-extra';
import config from 'config';

import Git from '../../src/app/history/git.js';

const fs = fsApi.promises;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CGUS_VERSIONS_PATH = path.resolve(__dirname, '../..', config.get('history.versionsPath'));
const TEMP_WORK_FOLDER = path.resolve(__dirname, '../..', 'tmp/');

const git = new Git(CGUS_VERSIONS_PATH);

const serviceMap = {
  AskFM: 'ASKfm',
  GoogleAdMob: 'AdMob',
  GoogleAdSense: 'AdSense',
  AppleAppStore: 'App Store',
  deviantART: 'DeviantArt',
  FacebookAds: 'Facebook Ads',
  FacebookPayments: 'Facebook Payments',
  GoogleAds: 'Google Ads',
  GoogleAnalytics: 'Google Analytics',
  GooglePlayStore: 'Google Play',
  LastFm: 'Last.fm',
  LinguaLeo: 'Lingualeo',
  StackOverflow: 'Stack Overflow',
  WeHeartIt: 'We Heart It',
  WeChatOpenPlatform: 'WeChat Open Platform'
};

const doctypeMap = {
  acceptable_use_policy: 'Acceptable Use Policy',
  brand_guidelines: 'Brand Guidelines',
  commercial_terms: 'Commercial Terms',
  community_guidelines: 'Community Guidelines',
  controller_controller_data_protection_terms: 'Data Controller Agreement',
  cookies_policy: 'Trackers Policy',
  'Cookies Policy': 'Trackers Policy',
  copyright_policy: 'Copyright Claims Policy',
  data_processing_terms: 'Data Processor Agreement',
  developer_agreement: 'Developer Terms',
  developer_policy: 'Developer Terms',
  in_app_purchases_policy: 'In-App Purchases Policy',
  law_enforcement_guidelines: 'Law Enforcement Guidelines',
  privacy_policy: 'Privacy Policy',
  review_guidelines: 'Review Guidelines',
  software_license_agreement: 'Software License Agreement',
  terms_of_service: 'Terms of Service',
  terms_of_service_parent_company: 'Parent Organization Terms',
  tos_parent: 'Parent Organization Terms',
  user_consent_policy: 'User Consent Policy'
};

async function getCommits() {
  const commits = await git.log([ '--stat=4096' ]);
  return commits.map(commit => extractLogInfos(commit));
}

function extractLogInfos(commit) {
  // parse a LogInfo object
  const { hash, date, message, diff: { files: filesChanged } } = commit;
  return { hash, date, message, filesChanged };
}

function makeFilename(target, filepath, date) {
  // given a target folder and a file path, create target dataset structure
  const splitted = filepath.split('/');
  let [ service ] = splitted.slice(-2);
  const [ fileName ] = splitted.slice(-1);
  let documentType = path.basename(fileName, '.md');

  if (doctypeMap[documentType]) {
    console.log(`Remapping ${documentType} to ${doctypeMap[documentType]}`);
    documentType = doctypeMap[documentType];
  }

  if (serviceMap[service]) {
    console.log(`Remapping ${service} to ${serviceMap[service]}`);
    service = serviceMap[service];
  }

  if (service === 'Skype') {
    if (documentType === 'undefined') {
      documentType = 'Parent Organization Terms';
    }
  }

  return path.join(target, service, documentType, `${date}.md`);
}

function isValidCommit(commitMessage) {
  // util function used for filtering CGUs commits
  const [ firstVerb ] = commitMessage.split(' ');
  return [ 'Update', 'Start', 'Refilter' ].includes(firstVerb);
}

async function makeData(commitInfo) {
  // Given info about a specific commit:
  // git checkout on that commit
  await git.checkout(commitInfo.hash);

  // compute target Folder and File Names
  const [ file ] = commitInfo.filesChanged;
  const filePath = path.join(git.path, file.file);
  const targetFilePath = makeFilename(TEMP_WORK_FOLDER, filePath, commitInfo.date);

  // create target (temp) folder if needed
  const pathCreated = await fs.mkdir(path.dirname(targetFilePath), { recursive: true });
  if (pathCreated) {
    console.log(`created ${pathCreated} as it did not exist.`);
  }

  await fs.copyFile(filePath, targetFilePath);
}

async function main() {
  const [ folderNameArg ] = process.argv.filter(el => el.startsWith('--folder-name='));

  const exportTargetFolderName = folderNameArg ? folderNameArg.split('=')[1] : 'dataset';

  const commits = await getCommits();

  const filteredCommits = commits.filter(({ message }) => isValidCommit(message));

  const [ date ] = new Date().toISOString().split('T');
  const [{ hash }] = filteredCommits;
  const headCommitShortSha = hash.slice(0, 7);
  const finalPath = path.resolve(__dirname, '../../data/', `${exportTargetFolderName}-${date}-${headCommitShortSha}`);
  console.log(`Exporting dataset to ${finalPath}`);

  for (const commit of filteredCommits) {
    console.log(`Handling commit ${commit.hash.slice(0, 7)}: ${commit.message}`);

    await makeData(commit); // eslint-disable-line no-await-in-loop
  }

  git.checkout('master'); // back to master when done

  await fse.copy(TEMP_WORK_FOLDER, finalPath); // copy temp dir to final destination

  await fs.rmdir(TEMP_WORK_FOLDER, { recursive: true });
  console.log(`Dataset is in ${finalPath}`);
}

(async () => {
  await main();
})();
