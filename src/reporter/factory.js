import GitHub from './github/index.js';
import GitLab from './gitlab/index.js';

export function createReporter(config) {
  switch (config.type) {
  case 'github':
    return new GitHub(config.repositories.declarations);
  case 'gitlab':
    return new GitLab(config.repositories.declarations, config.baseURL, config.apiBaseURL);
  default:
    throw new Error(`Unsupported reporter type: ${config.type}`);
  }
}
