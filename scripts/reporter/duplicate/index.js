import 'dotenv/config';
import config from 'config';
import { Octokit } from 'octokit';

async function removeDuplicateIssues() {
  try {
    const repository = config.get('@opentermsarchive/engine.reporter.githubIssues.repositories.declarations');

    if (!repository.includes('/') || repository.includes('https://')) {
      throw new Error(`Configuration entry "reporter.githubIssues.repositories.declarations" is expected to be a string in the format <owner>/<repo>, but received: "${repository}"`);
    }

    const [ owner, repo ] = repository.split('/');

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
        issuesByTitle.set(issue.title, [issue]);
      } else {
        issuesByTitle.get(issue.title).push(issue);
      }
    }

    for (const [ title, duplicateIssues ] of issuesByTitle) {
      if (duplicateIssues.length === 1) continue;

      const originalIssue = duplicateIssues.reduce((oldest, current) => (new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest));

      console.log(`\nFound ${duplicateIssues.length - 1} duplicates for issue #${originalIssue.number} "${title}"`);

      for (const issue of duplicateIssues) {
        if (issue.number === originalIssue.number) {
          continue;
        }

        await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', { /* eslint-disable-line no-await-in-loop */
          owner,
          repo,
          issue_number: issue.number,
          state: 'closed',
        });

        await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', { /* eslint-disable-line no-await-in-loop */
          owner,
          repo,
          issue_number: issue.number,
          body: `Closing duplicate issue. Original issue: #${originalIssue.number}`,
        });

        counter++;
        console.log(`Closed issue #${issue.number}: ${issue.html_url}`);
      }
    }

    console.log(`\nDuplicate removal process completed; ${counter} issues closed`);
  } catch (error) {
    console.log(`Failed to remove duplicate issues: ${error.stack}`);
    process.exit(1);
  }
}

removeDuplicateIssues();
