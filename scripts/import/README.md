# Import snapshots

Import snapshots history from git to MongoDB.

The script works by reading snapshots commits from a source repository and insert them in a MongoDB database.

### Configuring

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

See [renamer module documentation](../renamer/README.md).

### Running

Before importing commits you have to load them in the database:
```sh
NODE_ENV=import node scripts/import/loadCommits.js
```

Then import snapshots from commits:

```sh
NODE_ENV=import node scripts/import/index.js
```
### Important notes

- Your source repository will be read as is, so checkout the proper branch of commit before running the script.
- If you kill the script during its run, your source repository will probably be on a commit in the middle of the history, you need to manually checkout to the proper wanted commit of branche before re-running it.

### Currently handled cases

Currently, the script will:

- Ignore commits which are not a document snapshot (like renaming or documentation commits)
- Rename document types according to declared rules. See [renamer module documentation](../renamer/README.md)
- Rename services according to declared rules. See [renamer module documentation](../renamer/README.md)
