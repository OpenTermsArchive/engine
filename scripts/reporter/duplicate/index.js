import 'dotenv/config';
import config from 'config';
import { Octokit } from 'octokit';

async function removeDuplicateIssues() {
  try {
    const repository = config.get('@opentermsarchive/engine.reporter.githubIssues.repositories.declarations');
    const [ owner, repo ] = repository.split('/');

    if (!repository) {
      throw new Error('Repository configuration is not set');
    }

    const octokit = new Octokit({ auth: process.env.OTA_ENGINE_GITHUB_TOKEN });

    console.log(`Getting issues from repository ${repository}…`);

    const issues = await octokit.paginate('GET /repos/{owner}/{repo}/issues', {
      owner,
      repo,
      state: 'open',
      per_page: 100,
    });

    const onlyIssues = issues.filter(issue => !issue.pull_request);
    const issuesByTitle = new Map();
    let counter = 0;

    console.log(`Found ${onlyIssues.length} issues`);

    for (const issue of onlyIssues) {
      if (!issuesByTitle.has(issue.title)) {
        issuesByTitle.set(issue.title, issue);
        continue;
      }

      const existingIssue = issuesByTitle.get(issue.title);

      console.log(`Found duplicate for issue "${issue.title}"`);

      let issueToClose;

      if (new Date(issue.created_at) > new Date(existingIssue.created_at)) {
        issueToClose = issue;
      } else {
        issueToClose = existingIssue;
        issuesByTitle.set(issue.title, issue);
      }

      await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', { /* eslint-disable-line no-await-in-loop */
        owner,
        repo,
        issue_number: issueToClose.number,
        state: 'closed',
      });

      await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', { /* eslint-disable-line no-await-in-loop */
        owner,
        repo,
        issue_number: issueToClose.number,
        body: 'Closed duplicate issue.',
      });

      counter++;
      console.log(`Closed issue #${issueToClose.number}: ${issueToClose.html_url}`);
    }

    console.log(`Removed ${counter} issues`);
    console.log('Duplicate removal process completed');
  } catch (error) {
    console.log(`Failed to remove duplicate issues: ${error.stack}`);
    process.exit(1);
  }
}

removeDuplicateIssues();
