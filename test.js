const pg = require('pg');

const { Client } = pg;

const psqlClient = new Client({
  connectionString: process.env.PSQL_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: false
    // key: fs.readFileSync('.env/postgresql.key').toString(),
    // cert: fs.readFileSync('.env/postgresql.cert').toString()
  }
});
async function run() {
  const content = 'test';
  const documentDeclaration = {
    fetch: 'https://MRichard333.com/TOS'
  };
  await psqlClient.connect();
  const res = await psqlClient.query('UPDATE documents SET text = $1::text, updated_at=now() WHERE url = $2::text', [ content, documentDeclaration.fetch ]);
  console.log(res);
}

// ...
run();
