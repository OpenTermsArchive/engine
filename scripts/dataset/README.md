# Dataset release

Export dataset and publish it to GitHub releases.

## Configuring

You can change the configuration in the appropriate config file in `config` folder.

```json
{
  "dataset": {
    "servicesRepositoryName": "Name of the services declarations repository",
    "versionsRepositoryURL": "GitHub versions repository where dataset will be published"
  }
}
```

## Running

To export dataset:

```sh
node scripts/dataset/main.js [$filename]
```

To export and publish dataset:

```sh
node scripts/dataset/main.js --publish
```

To export, publish dataset and remove local copy:

```sh
node scripts/dataset/main.js --publish --remove-local-copy
```

To schedule export, publication and local copy removal:

```sh
node scripts/dataset/main.js --schedule --publish --remove-local-copy
```

## Adding renaming rules

See the [renamer module documentation](../renamer/README.md).
