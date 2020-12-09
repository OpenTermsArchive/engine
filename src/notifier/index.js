// import * as fs from 'fs';
import mysql from 'mysql';
import pg from 'pg';
import { checkQuotes } from '../checkQuotes.js';

// FIXME: Somehow Node.js ESM doesn't recognize this export:
//
// import { Client } from 'pg';
// ^^^^^^
// SyntaxError: The requested module 'pg' does not provide an export named 'Client'
//
// But it does work:
const { Client } = pg;
const { createConnection } = mysql;
// console.log(Client);
// console.log(createConnection);
// console.log(process.env);
// process.exit(0);

export default class Notifier {
  // mysqlConnection;
  // psqlClient;
  // mysqlConnected;
  // psqlConnected;
  constructor() {
    this.mysqlConnection = createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    });
    if (process.env.PSQL_CONNECTION_STRING) {
      this.psqlClient = new Client({
        connectionString: process.env.PSQL_CONNECTION_STRING,
        ssl: {
          rejectUnauthorized: false
          // key: fs.readFileSync('.env/postgresql.key').toString(),
          // cert: fs.readFileSync('.env/postgresql.cert').toString()
        }
      });
    } else {
      this.psqlClient = 'please specify PSQL_CONNECTION_STRING';
    }

    this.mysqlConnected = false;
    this.psqlConnected = false;
  }

  async doConnectMysql() {
    return new Promise((resolve, reject) => {
      this.mysqlConnection.connect(err => {
        if (err) {
          console.log('mysql connect fail', err);
          reject(err);
        } else {
          console.log(`connected as id ${this.mysqlConnection.threadId}`);
          resolve();
        }
      });
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async saveToEditTosdrOrg({ content, documentDeclaration, snapshotId, userId }) {
    try {
      console.log('saving to edit.tosdr.org', documentDeclaration, snapshotId);
      // console.log(content);
      if (!this.psqlConnected) {
        console.log('connecting psqlClient');
        this.psqlConnected = this.psqlClient.connect();
      }
      await this.psqlConnected;
      const res1 = await this.psqlClient.query('SELECT id FROM documents WHERE url = $1::text',
        [ documentDeclaration.fetch ]);
      if (res1.rows.length !== 1) {
        throw new Error(`Found ${res1.rows.length} documents with URL ${documentDeclaration.fetch}`);
      }
      await this.psqlClient.query('INSERT INTO document_comments (summary, document_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())', [ 'Updated crawl using tosback-crawler', res1.rows[0].id, userId ]);
      await this.psqlClient.query('UPDATE documents SET text = $1::text, updated_at=now() WHERE id = $2::int',
        [ content, res1.rows[0].id ]);
      // console.log(res);
      await checkQuotes(res1.rows[0].id, this.psqlClient, userId);
      console.log('Done saving to edit.tosdr.org');
    } catch (e) {
      console.error(e);
    }
  }

  async onVersionRecorded(serviceId, type, versionId) {
    if (!this.mysqlConnected) {
      await this.doConnectMysql();
      this.mysqlConnected = true;
    }
    await new Promise((resolve, reject) => {
      const queryStr = 'INSERT INTO notifications (site, name, created_at, updated_at, diff_url) VALUES (?, ?, now(), now(), ?)';
      const queryParams = [
        serviceId,
        type,
        `https://github.com/tosdr/tosback-versions/commit/${versionId}`
      ];
      console.log({ queryStr, queryParams });
      this.mysqlConnection.query(queryStr, queryParams, (err, result, fields) => {
        if (err) {
          console.log('mysql query fail', err);
          reject(err);
        } else {
          console.log('mysql query success', result, fields);
          resolve();
        }
      });
    });
  }

  end() {
    return this.psqlClient.end();
  }
}
