import fsApi from 'fs';

const fs = fsApi.promises;

export async function importReadme({ from: sourceAdapter, to: targetAdapter }) {
  const sourceAdapterReadmePath = `${sourceAdapter.path}/README.md`;
  const targetAdapterReadmePath = `${targetAdapter.path}/README.md`;

  const [readmeCommit] = await sourceAdapter.git.log(['README.md']);

  if (!readmeCommit) {
    console.warn(`No commits found for README in ${sourceAdapter.path}`);

    return;
  }

  await fs.copyFile(sourceAdapterReadmePath, targetAdapterReadmePath);
  await targetAdapter._commit(targetAdapterReadmePath, readmeCommit.message, readmeCommit.date);
}
