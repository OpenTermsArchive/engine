# Open Terms Archive Engine

This codebase is a Node.js module enabling downloading, archiving and publishing versions of documents obtained online. It can be used independently from the Open Terms Archive ecosystem. For a high-level overview of Open Terms Archive’s wider goals and processes, please read its [public homepage](https://opentermsarchive.org).

For documentation, visit [docs.opentermsarchive.org](https://docs.opentermsarchive.org/)

- - -
## Development

* Run the [`ota-to-postgres` branch of Phoenix](https://github.com/tosdr/edit.tosdr.org/tree/ota-to-postgres?tab=readme-ov-file#development) development setup using `docker compose up` as described in its readme.
* Don't forget the additional seeding step that runs `docker exec -it db psql -U postgres` and `update documents set url='http://example.com', selector='body'` there.
* `npm install`
* `node pg-test.js`

## Contribute

To contribute to the Open Terms Archive Engine, please refer to the [contributing guidelines](CONTRIBUTING.md) before submitting pull requests. Bugs can be reported or features requested by opening an issue.

## License

The code for this software is distributed under the [European Union Public Licence (EUPL) v1.2](https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12). In short, this [means](https://choosealicense.com/licenses/eupl-1.2/) you are allowed to read, use, modify and redistribute this source code, as long as you as you credit “Open Terms Archive Contributors” and make available any change you make to it under similar conditions.

Contact the core team over email at `contact@[project name without spaces].org` if you have any specific need or question regarding licensing.
