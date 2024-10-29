# Duplicate issues removal script

This script helps remove duplicate issues from a GitHub repository by closing newer duplicate issues.

## Prerequisites

1. Set up environment variables:
   - Create a `.env` file in the root directory
   - Add the GitHub personal access token of the bot that manage issues on your collection with repo permissions:
     ```
     OTA_ENGINE_GITHUB_TOKEN=your_github_token
     ```

2. Configure the target repository in `config/development.json`:
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

```
node scripts/reporter/duplicate/index.js
```
