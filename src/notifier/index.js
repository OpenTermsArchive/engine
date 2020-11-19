import * as mysql from 'mysql';

export default class Notifier {
  connection;
  connected;
  constructor() {
    this.connection = mysql.createConnection({
      host     : process.env.MYSQL_HOST,
      user     : process.env.MYSQL_USER,
      password : process.env.MYSQL_PASSWORD,
      database : process.env.MYSQL_DATABASE
    });
    this.connected = false;
  }

  async doConnect() {
    return new Promise((resolve, reject) => {
      connection.connect((err) => {
        if (err) {
          console.log("mysql connect fail", err)
          reject(err);
        } else {
          console.log('connected as id ' + connection.threadId);
          resolve();
        }
      });
    });
  }

  async onVersionRecorded(serviceId, type, versionId) {
    if (!this.connected) {
      await this.doConnect();
      this.connected = true;
    }
    await new Promise((resolve, reject) => {
      this.connection.query('INSERT INTO notifications (site, name, diff_url) VALUES (?, ?, ?)', [
        serviceId,
        type,
        versionId
      ], (err, result, fields) => {
        if (err) {
          console.log("mysql query fail", err)
          reject(err);
        } else {
          console.log("mysql query success", result, fields);
          resolve();
        }
      });
    });
  }
}
