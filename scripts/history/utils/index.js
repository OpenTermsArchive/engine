import fsApi from 'fs';

const fs = fsApi.promises;

export async function importReadme({ from: sourceRepository, to: targetRepository }) {
  const sourceRepositoryReadmePath = `${sourceRepository.path}/README.md`;
  const targetRepositoryReadmePath = `${targetRepository.path}/README.md`;

  const [readmeCommit] = await sourceRepository.git.log(['README.md']);

  if (!readmeCommit) {
    console.warn(`No commits found for README in ${sourceRepository.path}`);

    return;
  }

  await fs.copyFile(sourceRepositoryReadmePath, targetRepositoryReadmePath);
  await targetRepository._commit({
    filePath: targetRepositoryReadmePath,
    message: readmeCommit.message,
    date: readmeCommit.date,
  });
}
