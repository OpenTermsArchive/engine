// import * as fs from 'fs';
import mysql from 'mysql';
import pg from 'pg';

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
  getWords(str) {
    // states:
    // inTag
    // inSpace
    // inWord
    // when coming out of word, or when at the end, pushWord.
    let state = 'unknown';
    let thisWordStart;
    const words = [];
    function pushWord(endPos) {
      const text = str.substring(thisWordStart, endPos);
      const lower = text.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower.length) {
        words.push({
          start: thisWordStart,
          end: endPos,
          text,
          lower
        });
      }
    }
    for (let i = 0; i < str.length; i++) {
      if (state === 'in-tag') {
        if (str[i] === '>') {
          state = 'unknown';
        }
      } else {
        const newState = (str[i].match(/[a-zA-Z]/) === null ? 'in-space' : 'in-word');
        if (state === 'in-word' && newState === 'in-space') {
          pushWord(i);
        }
        if (state !== 'in-word' && newState === 'in-word') {
          thisWordStart = i;
        }
        state = newState;
      }
    }
    if (state === 'in-word') {
      pushWord(str.length);
    }
    // console.log(words.map(word => word.lower));
    return words;
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
      // console.log('Found start word!', quoteWords[0], startWord);
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
    // console.log('quote not found');
    return {
      startWord: false,
      endWordInParagraph: false
    };
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
        throw new Error(`Found ${res1.rows.length} documents with URL ${documentDeclaration.fetch}`)
      }
      await this.psqlClient.query('INSERT INTO document_comments (summary, document_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())', [ 'Updated crawl using tosback-crawler', res1.rows[0].id, userId ]);
      await this.psqlClient.query('UPDATE documents SET text = $1::text, updated_at=now() WHERE id = $2::int',
        [ content, res1.rows[0].id ]);
      // console.log(res);
      const queryTemplate = 'SELECT p."id", p."quoteText", p."quoteStart", p."quoteEnd", p."status" FROM points p INNER JOIN documents d ON p.document_id=d.id '
        + 'WHERE d.url = $1::text AND (p."status" = \'approved\' OR p."status" = \'pending\' OR p."status" = \'approved-not-found\' OR p."status" = \'pending-not-found\')';
      const pointsAffected = await this.psqlClient.query(queryTemplate,
        [ documentDeclaration.fetch ]);
      // const pointsAffected = {
      //   rows: [
      //     {
      //       quoteText: 'We believe you should always know what data we collect'
      //     }
      //   ]
      // };
      // console.log(pointsAffected);
      const words = this.getWords(content);
      const promises = pointsAffected.rows.map(async row => {
        const { startWord, endWordInParagraph } = this.findQuote(this.getWords(row.quoteText).map(word => word.lower), words.map(word => word.lower));
        if (startWord) {
          // const endWord = startWord + endWordInParagraph;
          const quoteStart = words[startWord].start;
          const quoteEnd = words[startWord + endWordInParagraph - 1].end;
          const quoteText = content.substring(quoteStart, quoteEnd);
          console.log('found', {
            id: row.id,
            quoteText,
            // quoteStartWord: startWord,
            // quoteEndWord: endWord,
            quoteStart,
            quoteEnd
          });
          let newStatus = row.status;
          if (newStatus === 'approved-not-found') {
            newStatus = 'approved';
          }
          if (newStatus === 'pending-not-found') {
            newStatus = 'pending';
          }
          await this.psqlClient.query('INSERT INTO point_comments (summary, point_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())', [ 'Found quote', row.id, userId ]);
          const queryTemplate = 'UPDATE points SET "quoteText" = $1::text, "quoteStart" = $2::int, "quoteEnd" = $3::int, "status" = $4::text WHERE "id" = $5::int';
          const queryResult = await this.psqlClient.query(queryTemplate, [ quoteText, quoteStart, quoteEnd, newStatus, row.id ]);
          console.log(queryResult);
        } else {
          console.log('not found', row);
          await this.psqlClient.query('INSERT INTO point_comments (summary, point_id, user_id, created_at, updated_at) VALUES ($1::text, $2::int, $3::int, now(), now())', [ 'Quote not found', row.id, userId ]);
          const queryTemplate = 'UPDATE points SET "status" = $1::text WHERE id = $2::int';
          const queryResult = await this.psqlClient.query(queryTemplate, [ `${row.status}-not-found`, row.id ]);
          console.log(queryResult);
        }
      });
      await Promise.all(promises);
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
