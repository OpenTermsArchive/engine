import fsApi from 'fs';

const fs = fsApi.promises;

export async function importReadmeInGit({ from: sourceRepository, to: targetRepository }) {
  const sourceRepositoryReadmePath = `${sourceRepository.path}/README.md`;
  const targetRepositoryReadmePath = `${targetRepository.path}/README.md`;

  const [firstReadmeCommit] = await sourceRepository.git.log(['README.md']);

  if (!firstReadmeCommit) {
    console.warn(`No commit found for README in ${sourceRepository.path}`);

    return;
  }

  await fs.copyFile(sourceRepositoryReadmePath, targetRepositoryReadmePath);
  await targetRepository._commit({
    filePath: targetRepositoryReadmePath,
    message: firstReadmeCommit.message,
    date: firstReadmeCommit.date,
  });
}
