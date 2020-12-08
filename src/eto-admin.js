import pg from 'pg';
import * as fs from 'fs';
import Notifier from './notifier/index.js';

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
async function getRow(model, idStr) {
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    throw new Error('First document id is not a number');
  }
  const res = await query(`SELECT * FROM ${model}s WHERE id= $1::int`, [ id ]);
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
    await query(`INSERT INTO ${dependentModelName}_comments (summary, ${dependentModelName}_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())`, [
      `Moving from ${mergedModelName}_id ${id1} to ${id2} due to ${mergedModelName} merge`,
      dependentId,
      userId
    ]);
    await query(`UPDATE ${dependentModelName}s SET ${mergedModelName}_id = $1::int WHERE id = $2::int`, [
      id2,
      dependentId
    ]);
  });
  await Promise.all(promises);
}

async function deleteRow(modelName, id1, id2, userId) {
  return query(`UPDATE ${modelName}s SET status = 'deleted', name = 'Merged into ${modelName} ${id2} by user ${userId}' WHERE id = $1::int`, [
    id1
  ]);
}

async function merge({ userId, model, arg1, arg2, fieldsToCheck, dependentModels }) {
  console.log(`Getting ${model}s`, arg1, arg2);
  const obj1 = await getRow(model, arg1);
  const obj2 = await getRow(model, arg2);
  fieldsToCheck.forEach(field => {
    if (obj1[field] !== obj2[field]) {
      throw new Error(`Can only merge ${model}s if their ${field} is the same`);
    }
  });
  console.log('Can merge', obj1.id, obj2.id);
  await addMergeComment(model, obj1.id, obj2.id, userId);
  await Promise.all(dependentModels.map(dependentModel => moveDependents(dependentModel, model, obj1.id, obj2.id, userId)));
  await deleteRow(model, obj1.id, obj2.id, userId);
}

async function updateCrawl({ userId, url, localPath }) {
  const notifier = new Notifier();

  const content = fs.readFileSync(localPath).toString();
  const documentDeclaration = {
    fetch: url
  };

  await notifier.saveToEditTosdrOrg({ content, documentDeclaration, snapshotId: '12345', userId });
  await notifier.end();
}

async function run({ userId, command, arg1, arg2 }) {
  await psqlClient.connect();
  console.log({ userId, command, arg1, arg2 });
  if (command === 'merge_documents') {
    await merge({ userId, model: 'document', arg1, arg2, fieldsToCheck: [ 'url', 'xpath', 'service_id' ], dependentModels: [ 'point' ] });
  } else if (command === 'merge_services') {
    await merge({ userId, model: 'service', arg1, arg2, fieldsToCheck: [ 'url' ], dependentModels: [ 'point', 'document' ] });
  } else if (command === 'update_crawl') {
    await updateCrawl({ userId, url: arg1, localPath: arg2 });
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
