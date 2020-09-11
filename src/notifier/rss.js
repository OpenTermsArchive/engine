import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
import config from 'config';

import feed from 'feed';
import Recorder from '../app/history/recorder.js';

dotenv.config();
export default class Notifier {
  constructor(passedServiceProviders) {
    this.serviceProviders = passedServiceProviders;

    this.feed = new feed.Feed({
      title: 'Latest CGUs document updates',
      description: 'Latest CGUs document updates from https://github.com/ambanum/CGUs.',
      id: config.get('history.versionsBaseUrl'),
      link: config.get('history.versionsBaseUrl'),
      author: {
        name: config.get('history.author.name'),
        email: config.get('history.author.email')
      }
    });

    // Eventually load previous feed from the JSON feed dump
    const jsonFeedPath = path.join(config.get('history.versionsPath'), 'json_feed.json');
    if (fs.existsSync(jsonFeedPath)) {
      const jsonFeed = JSON.parse(fs.readFileSync(jsonFeedPath));
      jsonFeed.items.forEach(item => {
        this.feed.addItem({
          title: item.title,
          id: item.id,
          link: item.url,
          description: item.summary,
          content: item.content_html,
          date: new Date(item.date_modified),
        });
      });
    }
  }

  addRssEntry(serviceId, type, versionId) {
    const versionsBaseUrl = config.get('history.versionsBaseUrl');
    const title = `${serviceId} just updated their ${type}`;
    const link = `${versionsBaseUrl}${versionId}`;
    const description = `We recorded a new version of ${serviceId}'s Terms of Service. View the changes at https://github.com/ambanum/CGUs-versions/commit/${versionId}.`;
    const content = `<p>We recorded a new version of ${serviceId}'s Terms of Service.</p><p><a href="${versionsBaseUrl}${versionId}"><button>View the changes</button></a></p><p>If the button does not work, copy the following address into your browser address bar: ${versionsBaseUrl}${versionId}.</p>`;

    this.feed.addItem({
      title,
      id: link,
      link,
      description,
      content,
      date: new Date(),
    });
  }

  async emitFeed() {
    const versionRecorder = new Recorder({ path: config.get('history.versionsPath'), fileExtension: 'xml' });
    // First, emit a JSON feed dump for easy updates in the future
    await versionRecorder.record({
      serviceId: null,
      documentType: 'json_feed',
      content: this.feed.json1(),
      changelog: 'Update RSS feed',
      mimeType: 'application/json'
    });
    // Then, emit the real RSS2 feed
    await versionRecorder.record({
      serviceId: null,
      documentType: 'rss',
      content: this.feed.rss2(),
      changelog: 'Update RSS feed',
    });
  }

  async onFirstVersionRecorded(serviceId, type, versionId) {
    this.addRssEntry(serviceId, type, versionId);
  }

  async onVersionRecorded(serviceId, type, versionId) {
    this.addRssEntry(serviceId, type, versionId);
  }

  async onRecordsPublished() {
    await this.emitFeed();
  }
}
