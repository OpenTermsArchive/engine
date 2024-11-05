# Duplicate issues removal script

This script helps remove duplicate issues from a GitHub repository by closing issues that have the same title as any older issue.

## Prerequisites

1. Set up environment variables:
   - Create a `.env` file in the root directory
   - Add the GitHub personal access token of the bot that manages issues on your collection, with `repo` permissions:

```shell
OTA_ENGINE_GITHUB_TOKEN=your_github_token
```

2. Configure the target repository in your chosen configuration file within the `config` folder:

```json
{
  "@opentermsarchive/engine": {
    "reporter": {
      "githubIssues": {
        "repositories": {
          "declarations": "owner/repository"
        }
      }
    }
  }
}
```

## Usage

Run the script using:

```shell
node scripts/reporter/duplicate/index.js
```
