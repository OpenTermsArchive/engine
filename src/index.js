import config from 'config';
import cron from 'croner';

import Archivist from './archivist/index.js';
import logger from './logger/index.js';
import Notifier from './notifier/index.js';
import Tracker from './tracker/index.js';

export default async function track({ services = [], termsTypes, extractOnly, schedule }) {
  const archivist = new Archivist({ recorderConfig: config.get('recorder') });

  archivist.attach(logger);

  await archivist.initialize();

  logger.info('Start Open Terms Archive\n');

  let servicesIds;

  if (services.length) {
    servicesIds = services.filter(serviceId => {
      const isServiceDeclared = archivist.serviceDeclarations[serviceId];

      if (!isServiceDeclared) {
        logger.warn(`Parameter "${serviceId}" was interpreted as a service ID to update, but no matching declaration was found; it will be ignored`);
      }

      return isServiceDeclared;
    });
  }

  // The result of the extraction step that generates the version from the snapshots may depend on changes to the engine or its dependencies.
  // The process thus starts by only performing the extraction process so that any version following such changes can be labelled (to avoid sending notifications, for example)
  await archivist.trackAllTermsChanges({ servicesIds, termsTypes, extractOnly: true });

  if (extractOnly) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    archivist.attach(new Notifier(archivist.serviceDeclarations));
  }

  if (process.env.GITHUB_TOKEN) {
    const tracker = new Tracker(config.get('tracker'));

    await tracker.initialize();
    archivist.attach(tracker);
  }

  if (!schedule) {
    await archivist.trackAllTermsChanges({ servicesIds, termsTypes });

    return;
  }

  logger.info('The scheduler is running…');
  logger.info('Terms will be tracked every six hours starting at half past midnight');

  cron('30 */6 * * *', () => archivist.trackAllTermsChanges({ servicesIds, termsTypes }));
}
