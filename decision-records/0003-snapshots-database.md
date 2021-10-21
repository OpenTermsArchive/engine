# Determining an appropriate database system to store snapshots

- Date: 2021-10-20

## Context and Problem Statement

Currently `git` is used as database for storing snapshots. The number of commits entries approaches the million.
The problem is that to iterate over these snapshots (for example to rewrite versions history) it currently takes more or less 3 months.
Also, git implies to store data in a hash tree in the form of chronologically ordered commits. So to insert snapshots in the history, it implies to rewrite the whole snapshots history which also takes the same time as reading them.

We need to be able to regenerate versions from snapshots (for example to [rename services](https://github.com/ambanum/OpenTermsArchive/issues/314)) and to be able to insert snapshots in the history (for example to [import databases](https://github.com/ambanum/OpenTermsArchive/pull/214)). This cannot take 6 months.

Moreover, as the number of snapshots will keep on growing, we need a system which allows scaling, potentially across multiple servers.

Thus, we need a database management system meeting the following requirements:

- Access time to a snapshot should be constant and independent from its authoring date.
- Inserting time of a snapshot should be constant and independent from its authoring date.
- Support concurrent access.
- Scale horizontally.

## Solution considered

MongoDB seems to meet the constraints:

- It natively allows horizontal scaling with [replica sets](https://docs.mongodb.com/manual/replication/) and [sharding](https://docs.mongodb.com/manual/sharding/).
- It supports concurrent access.
- It has [In-Memory storage engine](https://docs.mongodb.com/manual/core/inmemory/) as an option for performance.

We also did a simple test to ensure that access time and insert time also meets the requirements. We populated a database with one million entries and tried accessing snapshots with random dates and we found that access times remained stable. In our test on 1000 sequential access to random snapshot, the average access time was ~3.5ms with a maximum of ~50ms.

Moreover, MongoDB has the following benefits:

- Easy to use: offers a simple query syntax SQL and has a quick learning curve, especially for JavaScript developers.
- Flexible and evolutive: allows to manage data of any structure, not just tabular structures defined in advance.
- Widely used in the JavaScript ecosystem.

As downside, joining documents in MongoDB is no easy task and pulling data from several collections requires a number of queries, which will lead to long turn-around times. This is not a problem in our case as we do not currently envision a need for such complex queries.

## Decision Outcome

As MongoDB meets the requirements it is retained as a solution.
