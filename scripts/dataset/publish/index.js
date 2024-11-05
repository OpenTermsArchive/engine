import publishGitHub from './github/index.js';
import publishGitLab from './gitlab/index.js';

export default function publishRelease({ archivePath, releaseDate, stats }) {
  if (process.env.OTA_ENGINE_GITHUB_TOKEN) {
    return publishGitHub({ archivePath, releaseDate, stats });
  }

  if (process.env.OTA_ENGINE_GITLAB_TOKEN) {
    return publishGitLab({ archivePath, releaseDate, stats });
  }

  throw new Error('No GitHub or GitLab token found in environment variables (OTA_ENGINE_GITHUB_TOKEN or OTA_ENGINE_GITLAB_TOKEN). Cannot publish the dataset without authentication.');
}
