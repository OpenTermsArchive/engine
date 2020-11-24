# Rewrite history

As some document types or service names can change over time or as we need to import history from other tools, provided they have an history with the same structure as CGUs, we need a way to rewrite, reorder and apply changes to the snapshots history.

The script works by reading commits from a **source** repository, applying changes and then committing the result in another, empty or not, **target** repository. So a source repository with commits is required.

## Configuring

You can change the **source** and **target** repository in `config/rewrite.json`. We use `history` module to write in the **target** repository, so to configure **target** repo change the `history.snapshotPath` value:

```json
{
  "history": {
    "snapshotsPath": "<Target repository>"
  },
  "rewrite": {
    "snapshotsSourcePath": "<Source repository>"
  }
}
```

Other configuration are inherited from default `history` config.

## Running

Run every command by setting `NODE_ENV` to `rewrite`.

Run the script by running:

```sh
NODE_ENV=rewrite node scripts/rewrite/rewrite.js
```

You can write in an empty target repository and initialize it by passing the options `--init`:

```sh
NODE_ENV=rewrite node scripts/rewrite/rewrite.js --init
```

This option will create the repository if it does not exists.

:warning: **If the repository already exist it will be deleted and reinitialized by this options.**

The resulting rewritten history can be found in the configured target repository or by default in the `data/snapshots-rewritten` repository.

### Important notes

- Your source repository will be read as it, so checkout the proper branch of commit before running the script.
- If you kill the script during its run, your source repository will probably on a commit in the middle of the history, you need to manually checkout to the proper wanted commit of branche before re-running it.

## Adding renaming rules


### Service

To rename a service, add a rule in `renamingRules/services.json`, for example, to rename "GoogleAds" to "Google Ads", add the following line in the file:

```json
{
  …
  "GoogleAds": "Google Ads"
}
```

### Document type

To rename a document type, add a rule in `renamingRules/documentTypes.json`, for example, to rename "Program Policies" to "Acceptable Use Policy", add the following line in the file:

```json
{
  …
  "Program Policies": "Acceptable Use Policy"
}
```

### Document type for a specific service

To rename a document type only for a specific service, add a rule in `renamingRules/servicesDocumentTypes.json`, for example, to rename "Program Policies" to "Acceptable Use Policy" only for Skype, add the following line in the file:

```json
{
  …
  "Skype": {
    "Program Policies": "Acceptable Use Policy"
  }
}
```

### Currently handled cases:

Currently, the script will:
- Ignore commits which are not a document snapshot (like renaming or documentation commits)
- Reorder commits according to their author date
- Rename document types according to declared rules
- Rename services according to declared rules
- Skip commits with empty content
- Skip commits which do not change the document
- Skip commits from ToSBack import with empty content body
- Skip commits from ToSBack when CGUs already tracked the related document
- Rename commits from ToSBack ASKfm to Ask.com
