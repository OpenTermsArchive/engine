import { createRequire } from 'module';

import config from 'config';
import { Cron } from 'croner';
import cronstrue from 'cronstrue';

import { getCollection } from './archivist/collection/index.js';
import Archivist from './archivist/index.js';
import logger from './logger/index.js';
import Notifier from './notifier/index.js';
import Reporter from './reporter/index.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../package.json');

async function initialize(services) {
  const archivist = new Archivist({
    recorderConfig: config.get('@opentermsarchive/engine.recorder'),
    fetcherConfig: config.get('@opentermsarchive/engine.fetcher'),
  });

  archivist.attach(logger);

  await archivist.initialize();

  const collection = await getCollection();
  const collectionName = collection?.name ? ` with ${collection.name} collection` : '';

  logger.info(`Start engine v${PACKAGE_VERSION}${collectionName}\n`);

  if (services?.length) {
    services = services.filter(serviceId => {
      const isServiceDeclared = archivist.services[serviceId];

      if (!isServiceDeclared) {
        logger.warn(`Parameter "${serviceId}" was interpreted as a service ID to update, but no matching declaration was found; it will be ignored`);
      }

      return isServiceDeclared;
    });
  }

  return { archivist, services };
}

export default async function track({ services, types, schedule }) {
  const { archivist, services: filteredServices } = await initialize(services);

  // Technical upgrade pass: apply changes from engine, dependency, or declaration upgrades.
  // This regenerates versions from existing snapshots with updated extraction logic.
  // For terms with combined source documents, if a new document was added to the declaration, it will be fetched and combined with existing snapshots to regenerate the complete version.
  // All versions from this pass are labeled as technical upgrades to avoid false notifications about content changes.
  await archivist.applyTechnicalUpgrades({ services: filteredServices, types });

  if (process.env.OTA_ENGINE_SENDINBLUE_API_KEY) {
    try {
      archivist.attach(new Notifier(archivist.services));
    } catch (error) {
      logger.error('Cannot instantiate the Notifier module; it will be ignored:', error);
    }
  } else {
    logger.warn('Environment variable "OTA_ENGINE_SENDINBLUE_API_KEY" was not found; the Notifier module will be ignored');
  }

  if (process.env.OTA_ENGINE_GITHUB_TOKEN || process.env.OTA_ENGINE_GITLAB_TOKEN) {
    try {
      const reporter = new Reporter(config.get('@opentermsarchive/engine.reporter'));

      await reporter.initialize();
      archivist.attach(reporter);
    } catch (error) {
      logger.error('Cannot instantiate the Reporter module; it will be ignored:', error);
    }
  } else {
    logger.warn('Environment variable with token for GitHub or GitLab was not found; the Reporter module will be ignored');
  }

  if (!schedule) {
    await archivist.track({ services: filteredServices, types });

    return;
  }

  const trackingSchedule = config.get('@opentermsarchive/engine.trackingSchedule');
  const humanReadableSchedule = cronstrue.toString(trackingSchedule);

  logger.info('The scheduler is running…');
  logger.info(`Terms will be tracked ${humanReadableSchedule.toLowerCase()} in the timezone of this machine`);

  new Cron( // eslint-disable-line no-new
    trackingSchedule,
    { protect: job => logger.warn(`Tracking scheduled at ${new Date().toISOString()} were blocked by an unfinished tracking started at ${job.currentRun().toISOString()}`) },
    () => archivist.track({ services: filteredServices, types }),
  );
}

export async function applyTechnicalUpgrades({ services, types }) {
  const { archivist, services: filteredServices } = await initialize(services);

  await archivist.applyTechnicalUpgrades({ services: filteredServices, types });
}
