First of all, thanks for taking the time to contribute! 🎉👍

## Table of Contents

- [Workflow](#workflow)
  - [Pull requests](#pull-requests)
  - [Peer reviews](#peer-reviews)
  - [Commit messages](#commits-naming-convention)
- [Continuous delivery](#continuous-delivery)
- [Practices](#practices)
  - [Errors handling](#errors-handling)

---
## Workflow
### Pull requests

We follow the [GitHub Flow](https://guides.github.com/introduction/flow/): all code contributions are submitted via a pull request towards the `master` branch.

Opening a Pull Request means you want that code to be merged. If you want to only discuss it, send a link to your branch along with your questions through whichever communication channel you prefer.

#### Peer reviews

All pull requests must be reviewed by at least one person who is not their original author.

To help reviewers, make sure to describe your pull request with a **clear text explanation** of your changes.

### Commit messages

We strive to follow this [recommendation](https://chris.beams.io/posts/git-commit) to write our commit messages, which contains the following rules:

- [Separate subject from body with a blank line](https://chris.beams.io/posts/git-commit/#separate).
- [Limit the subject line to 50 characters](https://chris.beams.io/posts/git-commit/#limit-50).
- [Capitalize the subject line](https://chris.beams.io/posts/git-commit/#capitalize).
- [Do not end the subject line with a period](https://chris.beams.io/posts/git-commit/#end).
- [Use the imperative mood in the subject line](https://chris.beams.io/posts/git-commit/#imperative).
- [Wrap the body at 72 characters](https://chris.beams.io/posts/git-commit/#wrap-72).
- [Use the body to explain what and why vs. how](https://chris.beams.io/posts/git-commit/#why-not-how).

We add this additional rule:

- Do not rely on GitHub issue reference numbers in commit messages, as we have no guarantee the host system and its autolinking will be stable in time. Make sure the context is self-explanatory. If an external reference is given, use its full URL.


## Continuous delivery

GitHub Actions is used to deploy the application every time there is a commit or a merge on master branch.
## Practices

### Errors handling

First of all it's important to distinguish two fundamentally different kinds of errors: **operational** and **programmer** errors.

- **Operational errors represent run-time problems experienced by correctly-written programs**. These are not bugs in the program. These are usually problems with something else: the system itself (e.g. out of memory), the system’s configuration (e.g. no route to a remote host), the network (e.g. socket hang-up), or a remote service (e.g. a 500 error).

- **Programmer errors are bugs in the program**. These are things that can always be avoided by changing the code. They can never be handled properly, since by definition the code in question is broken (e.g. tried to read property of `undefined`, or forget to `await` an asynchronous function).

So the very important distinction is that operational errors are part of the **normal operation of a program** whereas programmer errors are **bugs**.

Also noteworthy, failure to handle an operational error is itself a programmer error.

#### Handling operational errors

There are five ways to handle operational errors:
- **Deal with the failure directly**. For example, create directory if it's missing.
- **Propagate the failure**. If you don’t know how to deal with the error, the simplest thing to do is to abort whatever operation you’re trying to do, clean up whatever you’ve started, and propagate the error.
- **Retry the operation**. For example, try to reconnect if the connection is lost.
- **Log the error — and do nothing else**. If it's a minor error and there’s nothing you can do about, and there is no reason to stop the whole process.
- **Crash immediately**. If the error cannot be handled and can affect data integrity.

In our case, we consider all `fetch`-related errors as expected, so as operational errors and we handle them by logging but we do not stop the whole process. We handle errors related to the `notifier` in the same way.
In contrast, we consider errors from the `recorder` module as fatal, and we crash immediately.

#### Handling programmer errors

**The best way to handle programmer errors is to crash immediately.** Indeed, it is not recommended to attempt to recover from programmer errors — that is, allow the current operation to fail, but keep handling requests. Consider that a programmer error is a case that you didn’t think about when you wrote the original code. How can you be sure that the problem won’t affect the program itself and the data integrity?

This section is highly inspired, and in part extracted, from [this error handling guide](https://www.joyent.com/node-js/production/design/errors).
