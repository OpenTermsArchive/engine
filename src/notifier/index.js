// import * as fs from 'fs';
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
    // this.mysqlConnection = mysql.createConnection({
    //   host: process.env.MYSQL_HOST,
    //   user: process.env.MYSQL_USER,
    //   password: process.env.MYSQL_PASSWORD,
    //   database: process.env.MYSQL_DATABASE
    // });
    this.psqlClient = new Client({
      connectionString: process.env.PSQL_CONNECTION_STRING,
      ssl: {
        rejectUnauthorized: false
        // key: fs.readFileSync('.env/postgresql.key').toString(),
        // cert: fs.readFileSync('.env/postgresql.cert').toString()
      }
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
  async saveToEditTosdrOrg({ content, documentDeclaration, snapshotId }) {
    try {
      console.log('saving to edit.tosdr.org', documentDeclaration, snapshotId);
      console.log(content);
      if (!this.psqlConnected) {
        console.log('connecting psqlClient');
        this.psqlConnected = this.psqlClient.connect();
      }
      await this.psqlConnected;
      const res = await this.psqlClient.query('UPDATE documents SET text = $1::text, updated_at=now() WHERE url = $2::text',
        [ content, documentDeclaration.fetch ]);
      console.log(res);
      const queryTemplate = 'SELECT p."id", p."quoteText", p."quoteStart", p."quoteEnd" FROM points p INNER JOIN documents d ON p.document_id=d.id '
        + 'WHERE url = $1::text';
      const pointsAffected = await this.psqlClient.query(queryTemplate,
        [ documentDeclaration.fetch ]);
      console.log(pointsAffected);
      const documentWords = content.split(' ').map(str => str.trim());
      await Promise.all(pointsAffected.rows.forEach(row => {
        const existingWords = row.quoteText.split(' ').map(str => str.trim());
        // See https://github.com/tosdr/tosback-crawler/issues/6#issuecomment-731179847
        let unfound = 0;
        let startWord = 0;
        let documentPointer;
        for (let i = 0; i < existingWords.length; i++) {
          const index = documentWords.indexOf(existingWords[i], startWord);
          console.log('looking for word', i, existingWords[i], startWord, index, documentWords.length);
          if (index === -1) {
            console.log('unfound word', existingWords[i]);
            unfound++;
            if (unfound > 2) {
              return false;
            }
            break;
          } else {
            unfound = 0;
          }
          if (startWord === -1) {
            startWord = index;
            documentPointer = index;
          } else if (index === -1) {
            unfound++;
            if (unfound > 2) {
              return false;
            }
          } else if (index - documentPointer > 2) {
            console.log('startWord failed', startWord, index, documentPointer);
            startWord = -1;
          }
        }
        console.log('found', startWord, documentPointer);
        return true;
      }));
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

  end() {
    return this.psqlClient.end();
  }
}
