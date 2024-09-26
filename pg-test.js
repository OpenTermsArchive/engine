import pg from 'pg'
const { Client } = pg
const client = new Client({
  user: 'postgres',
  database: 'postgres',
  host: '127.0.0.1'
})
await client.connect()
 
const res = await client.query('SELECT url,selector from documents')
console.log(res.rows) // Hello world!
await client.end()
