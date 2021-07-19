### Exporting a dataset

_NB: The content of a versions repo `OpenTermsArchive-versions` must be in `./data/versions`._

Export data:

```sh
npm run export
```

The resulting dataset can be found in `data/dataset-YYYY-MM-DD-SHORT_SHA`.

Export data to any folder (path is relative to the root of this repo)

```sh
npm run export -- --folder-name=/target/dir
```
