import Notifier from './notifier/index.js';

const notifier = new Notifier();
notifier.onVersionRecorded('example.com', 'some doc', 'version id');
