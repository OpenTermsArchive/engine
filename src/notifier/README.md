This code powers tosback.org (a job on the crontab of the tosback3 user runs ./run.sh once every day, see ./run.sh-example for a version of that script with the MySQL password removed).
It will also feeds into edit.tosdr.org which feeds into tosdr.org. For that, until now I use:
```sh
export MYSQL_HOST=localhost
export MYSQL_USER=root
export MYSQL_PASSWORD="..."
export MYSQL_DATABASE=tosback
export PSQL_CONNECTION_STRING="..."
node src/test.js
```

There is also an admin script that I use for maintenance on the edit-tosdr-org production database.
For instance, to merge document 123 into document 456, as userId 789, run:
```sh
export PSQL_CONNECTION_STRING="..."
node src/eto-admin.js 789 merge_documents 456 789
```

