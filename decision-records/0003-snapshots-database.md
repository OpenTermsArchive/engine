# Determining an appropriate database system to store snapshots

- Date: 2021-10-20

## Context and Problem Statement

### Context

The Versions repository has several purposes:

- Display differences between two versions, in particular when users receive a notification of change, so that they can simply see the changes.
- Explore significant changes in tracked documents.
- Offer a corpus of the latest versions of all the documents of the monitored services.
- Serve as a dataset for research.

It is therefore important that repository constitutes a quality dataset, to provide relevant information to users.

For this purpose, the following constraints are considered necessary:

- Versions must be ordered chronologically, so that navigation through the history of a document is intuitive.
- Versions should not contain noise, only significant changes.
- Each version must contain a link to the snapshot that was used to generate it.

Currently, the following problems with the repository of Versions are identified:

- Noise in the versions: URL or structure changes in the tracked documents.
- Presence of refilter commits: related to URL and selector updates in service declarations or to Open Terms Archive code evolution.
- Presence of commits due to code changes: type renaming, service renaming, documentation changes in the repository.
- Presence of unordered commits: consequence of the import of the ToSBack history in snapshots or to the import of snapshots corresponding to archived documents provided by the services themselves.

The solution considered in order to provide a quality dataset therefore consists of being able to regenerate the `versions` from the `snapshots`, that's what we call rewriting history.

#### Rewriting history

To rewrite history, we go through the snapshot commits one by one after reordering them (in memory) and we create a version commit each time, avoiding commits corresponding to noise and performing any renaming.

This implies being able to version the service filters (used to generate the version from the snapshot).
See https://github.com/OpenTermsArchive/engine/issues/156.

### Problem

Currently, `git` is used as database for storing snapshots and versions.
One year ago, the process to rewrite history was estimated to take about 16 hours for 100,000 commits. It has also been noted that the evolution of the time is not linear, the more commits there are in `snapshots` the more the average time per commit increases.

It appears that the most costly operation is accessing the contents of a commit (checkout).
It also appears that the older the commit is in the git history, the longer this operation takes.

> For example, on a history containing about 100,000 commits, accessing the contents of the oldest commit takes about 1,000 ms while accessing the most recent commit takes only 100 ms.

At the date of this document, the number of commits entries approaches the million and to iterate over these snapshots, to rewrite versions history, it currently takes more or less 3 months.


Also, `git` implies to store data in a hash tree in the form of chronologically ordered commits. So to insert snapshots in the history, it implies to rewrite the whole snapshots history which also takes the same time as reading them.

As described previously, we need to be able to regenerate versions from snapshots (for example to [rename services](https://github.com/OpenTermsArchive/engine/issues/314)) and to be able to insert snapshots in the history (for example to [import databases](https://github.com/OpenTermsArchive/engine/pull/214)).
**This cannot take 6 months.**

Moreover, as the number of snapshots will keep on growing, we need a system which allows scaling, potentially across multiple servers.

Thus, we need a database management system meeting the following requirements:

- Access time to a snapshot should be constant and independent from its authoring date.
- Inserting time of a snapshot should be constant and independent from its authoring date.
- Support concurrent access.
- Scale horizontally.

### Solutions considered

#### 1. Keep the system under git

##### Splitting into sub-repos

Since accessing the contents of a commit takes longer the older it is in the history considered, the idea would be to work successively on ordered subsets of this history.
This means truncating the history, browsing the remaining commits and regenerating the corresponding versions. Then creating another subset of the history which contains an arbitrary number of commits following the commits already browsed and perform the processing.

To create a history subset with git :
- Create a clone of a subset of N commits from the local snapshot: `git clone --depth <N> "file://local/path/snapshots" snapshots-tmp` with `N` corresponding to the position of the first commit you want in the block relative to the last commit in the history
- Remove all commits older than the last commit you want to keep in the block: `git reset --hard <sha>` with `sha` corresponding to the id of the last commit you want to have in the block.
- Clean up git to ensure that history navigation is efficient: `git gc`.

So we need to split the history into chronologically ordered blocks, which leads us to the next problem.

##### Splitting and reordering blocks of snapshots

Because snapshot commits are unordered, we can't simply create blocks of a fixed size from the git history (otherwise we'd process commits out of order).
It is necessary to create blocks whose commits are ordered within the block but also in relation to the other blocks: for example, all the commits of the first block processed must be older than the commits of all the other blocks.

The solution would be to create blocks in order: from the git history, we look for commits that are not in their place (whose date is earlier than that of its predecessor).

Each of these commits represents the first commit of a block. This block extends to the previous one, the starting point of the next block.
We thus obtain blocks whose commits are ordered.

We still have to order the blocks between them (note, it is possible to have to cut a block to be able to place another).

These chronologically ordered commit blocks, without overlap, can then be used with the previous approach (it may be necessary to re-split these blocks so that they have a reasonable size).

#### 2. Move snapshots to a document-oriented database

The idea of this solution is to keep the `versions` under git in order to continue to enjoy the benefits that GitHub provides in terms of browsing and viewing diffs, but to save the snapshots in a database, since we don't really need to browse the snapshots via a graphical interface nor to see the diff between two snapshots, which would allow us to be able to access the content more efficiently.

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

### Benchmark

With MongoDB implementation, refilter takes around ~3m where it took around ~1h20 with the Git version.
