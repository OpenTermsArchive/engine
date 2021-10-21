# Determine which database system is appropriate to store snapshots

- Date: 2021-10-20

## Context and Problem Statement

Currently `git` is used as database for storing snapshots and the numbers of commits entries approach the million.
The problem is that to iterate over these snapshots (for example to rewrite versions history) it currently takes more or less 3 months.
Also, git implies to store data in a hash tree in the form of chronologically ordered commits. So to insert snapshots in the history, it implies to rewrite the whole snapshots history which also takes the same time.

We need to be able to regenerate versions from snapshots and to be able to insert snapshots in the history more quickly.

Moreover, as the number of snapshots will grow importantly, we need a system which allow scaling accross multiple server.

So we need a database management system with the following requirements:
- Access time to a snapshot should be constant and independant from its author date
- Inserting time of a snapshot should be constant and independant from its author date
- Support concurrent access
- Scale horizontaly

## Solution considered

MongoDb seems to meet the constraints:
- It natively allows horizontal scaling with replica set and sharding.
- It supports concurrent access.
- It has In-Memory storage engine possibility for performance.

We also did a simple test to ensure that access time and insert time also meets the requirements. We populated a database with one million entries and test to access snapshots with random dates and we found that access times remained stable.

Moreover MongoDB has the following benefits:

- Easy to use: simple API and quick learning curve.
- Lightweight: no heavy dependency on the server.
- Flexible and evolutive: allows to manage data of any structure, not just tabular structures defined in advance.
- Widely used in the JavaScript ecosystem.

As downside, joining documents in MongoDB is no easy task and pulling data from several collections requires a number of queries, which will lead to long turn-around times. This is not a problem in our case as we do not need such complex queries.

## Decision Outcome

As MongoDB meets the requirements it is retained as solution.
