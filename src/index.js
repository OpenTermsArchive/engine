import { createRequire } from 'module';

import config from 'config';
import cron from 'croner';
import cronstrue from 'cronstrue';

import Archivist from './archivist/index.js';
import logger from './logger/index.js';
import Notifier from './notifier/index.js';
import Reporter from './reporter/index.js';

const require = createRequire(import.meta.url);

export default async function track({ services, types, extractOnly, skipPreRun, skipSnapshots, skipReadBack, schedule, shard }) {
    const archivist = new Archivist({
    recorderConfig: config.get('@opentermsarchive/engine.recorder'),
    fetcherConfig: config.get('@opentermsarchive/engine.fetcher'),
  });

  archivist.attach(logger);

  await archivist.initialize();

  const { version } = require('../package.json');

  logger.info(`Start Open Terms Archive engine v${version}\n`);

  if (services?.length) {
    services = services.filter(serviceId => {
      const isServiceDeclared = archivist.services[serviceId];

      if (!isServiceDeclared) {
        logger.warn(`Parameter "${serviceId}" was interpreted as a service ID to update, but no matching declaration was found; it will be ignored`);
      }

      return isServiceDeclared;
    });
  }

  // The result of the extraction step that generates the version from the snapshots may depend on changes to the engine or its dependencies.
  // The process thus starts by only performing the extraction process so that any version following such changes can be labelled (to avoid sending notifications, for example)
  if (!skipPreRun) {
    await archivist.track({ services, types, extractOnly: true, skipSnapshots, skipReadBack: false /* this is the prerun, skipping readback makes no sense here */, shard });
  }

  if (extractOnly && !skipPreRun) {
    return;
  }

  if (process.env.OTA_ENGINE_SENDINBLUE_API_KEY) {
    try {
      archivist.attach(new Notifier(archivist.services));
    } catch (error) {
      logger.error('Cannot instantiate the Notifier module; it will be ignored:', error);
    }
  } else {
    logger.warn('Environment variable "OTA_ENGINE_SENDINBLUE_API_KEY" was not found; the Notifier module will be ignored');
  }

  if (process.env.OTA_ENGINE_GITHUB_TOKEN) {
    if (config.has('@opentermsarchive/engine.reporter.githubIssues.repositories.declarations')) {
      try {
        const reporter = new Reporter(config.get('@opentermsarchive/engine.reporter'));

        await reporter.initialize();
        archivist.attach(reporter);
      } catch (error) {
        logger.error('Cannot instantiate the Reporter module; it will be ignored:', error);
      }
    } else {
      logger.warn('Configuration key "reporter.githubIssues.repositories.declarations" was not found; issues on the declarations repository cannot be created');
    }
  } else {
    logger.warn('Environment variable "OTA_ENGINE_GITHUB_TOKEN" was not found; the Reporter module will be ignored');
  }

  if (!schedule) {
    await archivist.track({ services, types, extractOnly, skipSnapshots, skipReadBack, shard });

    return;
  }

  const trackingSchedule = config.get('@opentermsarchive/engine.trackingSchedule');
  const humanReadableSchedule = cronstrue.toString(trackingSchedule);

  logger.info('The scheduler is running…');
  logger.info(`Terms will be tracked ${humanReadableSchedule.toLowerCase()} in the timezone of this machine`);

  cron(
    trackingSchedule,
    { protect: job => logger.warn(`Tracking scheduled at ${new Date().toISOString()} were blocked by an unfinished tracking started at ${job.currentRun().toISOString()}`) },
    () => archivist.track({ services, types }),
  );
}
