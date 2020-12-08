import pg from 'pg';

const { Client } = pg;

if (!process.env.PSQL_CONNECTION_STRING) {
  throw new Error('Please specify PSQL_CONNECTION_STRING');
}
const psqlClient = new Client({
  connectionString: process.env.PSQL_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: false
    // key: fs.readFileSync('.env/postgresql.key').toString(),
    // cert: fs.readFileSync('.env/postgresql.cert').toString()
  }
});

function query(template, params) {
  console.log('Q:', template, params);
  return psqlClient.query(template, params);
}
async function getRow(tableName, idStr) {
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    throw new Error('First document id is not a number');
  }
  const res = await query(`SELECT * FROM ${tableName} WHERE id= $1::int`, [ id ]);
  if (res.rows.length !== 1) {
    throw new Error(`Found ${res.rows.length} rows`);
  }
  return res.rows[0];
}

async function addMergeComment(modelName, id1, id2, userId) {
  await query(`INSERT INTO ${modelName}_comments (summary, ${modelName}_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())`, [
    `Merged this ${modelName} into ${modelName} ${id2}`,
    id1,
    userId
  ]);
  await query(`INSERT INTO ${modelName}_comments (summary, ${modelName}_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())`, [
    `Merged ${modelName} ${id1} into this ${modelName} `,
    id2,
    userId
  ]);
}

async function moveDependents(dependentModelName, mergedModelName, id1, id2, userId) {
  const affected = await query(`SELECT id FROM ${dependentModelName}s WHERE ${mergedModelName}_id = $1::int`, [
    id1
  ]);
  const dependentIds = affected.rows.map(row => row.id);
  console.log(dependentIds);
  const promises = dependentIds.map(async dependentId => {
    await query(`INSERT INTO ${dependentModelName}_comments (summary, ${dependentModelName}_id, user_i, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now()`, [
      `Moving from ${mergedModelName}_id ${id1} to ${id2} due to ${mergedModelName} merge`,
      dependentId,
      userId
    ]);
    await query(`UPDATE ${dependentModelName}s SET ${mergedModelName}_id = $1::int WHERE id = $3::int`, [
      id2,
      dependentId
    ]);
  });
  await Promise.all(promises);
}

async function deleteRow(modelName, id1) {
  return query(`UPDATE ${modelName}s SET status = 'deleted' WHERE id = $1::int`, [
    id1
  ]);
}

async function run({ userId, command, arg1, arg2 }) {
  await psqlClient.connect();
  console.log({ userId, command, arg1, arg2 });
  if (command === 'merge_documents') {
    console.log('Getting documents', arg1, arg2);
    const doc1 = await getRow('documents', arg1);
    const doc2 = await getRow('documents', arg2);
    // console.log(doc1);
    // console.log(doc2);
    if (doc1.url !== doc2.url) {
      throw new Error('Can only merge documents if their URL is the same');
    }
    if (doc1.xpath !== doc2.xpath) {
      throw new Error('Can only merge documents if their xpath is the same');
    }
    if (doc1.service_id !== doc2.service_id) {
      throw new Error('Can only merge documents if their service_id is the same');
    }
    console.log('Can merge', doc1.id, doc2.id);
    await addMergeComment('document', doc1.id, doc2.id, userId);
    await moveDependents('point', 'document', doc1.id, doc2.id, userId);
    await deleteRow('document', doc1.id, userId);
  }
  console.log('ending');
  await psqlClient.end();
}

// ...
run({
  userId: process.argv[2],
  command: process.argv[3],
  arg1: process.argv[4],
  arg2: process.argv[5]
});
