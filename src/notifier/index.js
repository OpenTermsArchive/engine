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
    this.mysqlConnection = mysql.createConnection({
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
  getWords(str) {
    return {
      words: str.toLowerCase().replace(/<[^>]*>/g, '').split(/\s+/).map(str => str.replace(/[^a-z0-9]/g, '')),
      sourceMap: {}
    };
  }

  // eslint-disable-next-line class-methods-use-this
  wordsLineUp(quoteWords, paragraphWords) {
    let quotePointer = 0;
    let paragraphPointer = 0;
    do {
      if (paragraphPointer >= paragraphWords.length) {
        return false;
      }
      if (quoteWords[quotePointer] === paragraphWords[paragraphPointer]) {
        // console.log('in step', quotePointer, paragraphPointer, quoteWords[quotePointer]);
        quotePointer++;
        paragraphPointer++;
      } else if ((quotePointer + 1 < quoteWords.length) && (quoteWords[quotePointer + 1] === paragraphWords[paragraphPointer])) {
        // console.log('skipping in quote', quotePointer, paragraphPointer, quoteWords[quotePointer], quoteWords[quotePointer + 1]);
        quotePointer += 2;
        paragraphPointer++;
      } else if ((paragraphPointer + 1 < paragraphWords.length) && (quoteWords[quotePointer] === paragraphWords[paragraphPointer + 1])) {
        // console.log('skipping in paragraph', quotePointer, paragraphPointer, paragraphWords[paragraphPointer], quoteWords[quotePointer]);
        quotePointer++;
        paragraphPointer += 2;
      } else if ((quotePointer + 1 < quoteWords.length) && (paragraphPointer + 1 < paragraphWords.length) && (quoteWords[quotePointer + 1] === paragraphWords[paragraphPointer + 1])) {
        // console.log('skipping in both', quotePointer, paragraphPointer, quoteWords[quotePointer], quoteWords[quotePointer + 1], paragraphWords[paragraphPointer], paragraphWords[paragraphPointer + 1]);
        quotePointer += 2;
        paragraphPointer += 2;
      } else {
        // console.log('fork', quotePointer, paragraphPointer, quoteWords[quotePointer], quoteWords[quotePointer + 1], paragraphWords[paragraphPointer], paragraphWords[paragraphPointer + 1]);
        return false;
      }
    } while (quotePointer < quoteWords.length);
    return paragraphPointer;
  }

  findQuote(quoteWords, documentWords) {
    // console.log('Finding quote', quoteWords);
    let searchStart = 0;
    let startWord;
    do {
      startWord = documentWords.indexOf(quoteWords[0], searchStart);
      const endWordInParagraph = this.wordsLineUp(quoteWords, documentWords.slice(startWord));
      if (endWordInParagraph !== false) {
        // console.log('Found', quoteWords[0], startWord);
        return {
          startWord,
          endWordInParagraph
        };
      }
      searchStart = startWord + 1;
    } while (startWord !== -1);
    // throw new Error('quote not found!');
    return {
      startWord: false,
      endWordInParagraph: false
    };
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
      const { words, sourceMap } = this.getWords(content);
      pointsAffected.rows.forEach(row => {
        const { startWord, endWordInParagraph } = this.findQuote(this.getWords(row.quoteText).words, words);
        console.log({
          quoteText: row.quoteText,
          quoteStartWord: startWord,
          quoteEndWord: startWord + endWordInParagraph,
          quoteStart: sourceMap[startWord],
          quoteEnd: sourceMap[startWord + endWordInParagraph]
        });
      });
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
        versionId
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
