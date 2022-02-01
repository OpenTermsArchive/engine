# Import snapshots

Import snapshots history from git to MongoDB.

## How it works

The import process is split into two scripts for performance reasons (reading commits from a huge git repository takes a long time). The first script `loadCommits.js` reads commits from a source repository and inserts them as is (without file contents) into a MongoDB database.
The second script, `index.js`, reads the commits from the MongoDB database, retrieves the contents from GitHub, applies renaming rules if necessary, and then inserts them into another collection in the database with a format compatible with the OpenTermsArchive application.
## Configuring

You can change the configuration in `config/import.json`.

```json
{
  "import": {
    "sourcePath": "Path of the source repository",
    "githubRepository": "Snapshots GitHub repository identifier. Should respect the format: <organisation_or_user_name>/<repository_name>",
    "mongo": {
      "connectionURI": "URI for defining connection to the MongoDB instance. See https://docs.mongodb.com/manual/reference/connection-string/",
      "database": "Database name",
      "collection": "Collection name"
    }
  }
}
```

## Adding renaming rules

See the [renamer module documentation](../renamer/README.md).

## Running

**You should execute commands from the `scripts/import` directory to ensure config is properly loaded:**

```
cd scripts/import
```

Before importing commits you have to load them in the database:
```sh
NODE_ENV=import node scripts/import/loadCommits.js
```

Then import snapshots from commits:
```sh
NODE_ENV=import node scripts/import/index.js
```
## Important notes

- Your source repository will be read as is, so checkout the proper branch of commit before running the script.

### Edge cases

The script will:

- Ignore commits which are not a document snapshot (like renaming or documentation commits).
- Rename document types according to declared rules. See the [renamer module documentation](../renamer/README.md).
- Rename services according to declared rules. See the [renamer module documentation](../renamer/README.md).
- Handle duplicates, so you can run it twice without worrying about duplicate entries in the database.
