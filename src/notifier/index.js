import * as mysql from 'mysql';
import pg from 'pg';

// FIXME: Somehow Node.js ESM doesn't recognize this export:
//
// import { Client } from 'pg';
// ^^^^^^
// SyntaxError: The requested module 'pg' does not provide an export named 'Client'
//
// But it does work:
const { Client } = pg;

export default class Notifier {
  // mysqlConnection;
  // psqlClient;
  // mysqlConnected;
  // psqlConnected;
  constructor() {
    this.mysqlConnection = mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    });
    this.psqlClient = new Client({
      connectionString: process.env.PSQL_CONNECTION_STRING
    });

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
  async saveToEditTosdrOrg({ serviceId, content, documentType, snapshotId }) {
    console.log('saving to edit.tosdr.org', serviceId, documentType, snapshotId);
    console.log(content);
    if (!this.mysqlConnected) {
      await this.psqlClient.connect();
      this.psqlConnected = true;
    }
    const res = await this.psqlClient.query('SELECT d.name, d.xpath, d.url, s.url as domains, s.name as service from documents d inner join services s on d.service_id=s.id LIMIT 1');
    await Promise.all(res.rows.map(row => console.log(row)));
    // await this.psqlClient.end();
  }

  async onVersionRecorded(serviceId, type, versionId) {
    if (!this.mysqlConnected) {
      await this.doConnectMysql();
      this.mysqlConnected = true;
    }
    await new Promise((resolve, reject) => {
      this.mysqlConnection.query('INSERT INTO notifications (site, name, created_at, updated_at, diff_url) VALUES (?, ?, now(), now(), ?)', [
        serviceId,
        type,
        versionId
      ], (err, result, fields) => {
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
}
