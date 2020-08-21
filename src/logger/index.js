export function onStartTrackingChanges() {
  console.log('Start tracking changes…');
}

export function onEndTrackingChanges() {
  console.log('\n');
}

export function onStartRefiltering() {
  console.log('Refiltering documents… (it could take a while)');
}

export function onEndRefiltering() {
  console.log('\n');
}

export function onFirstSnapshotRecorded(serviceId, type, versionId) {
  console.log(logPrefix(serviceId, type), `Recorded first snapshot with id ${versionId}.`);
}

export function onSnapshotRecorded(serviceId, type, snapshotId) {
  console.log(logPrefix(serviceId, type), `Recorded snapshot with id ${snapshotId}.`);
}

export function onNoSnapshotChanges(serviceId, type) {
  console.log(logPrefix(serviceId, type), 'No changes, did not record snapshot.');
}

export function onFirstVersionRecorded(serviceId, type, versionId) {
  console.log(logPrefix(serviceId, type), `Recorded first version with id ${versionId}.`);
}

export function onVersionRecorded(serviceId, type, versionId) {
  console.log(logPrefix(serviceId, type), `Recorded version with id ${versionId}.`);
}

export function onNoVersionChanges(serviceId, type) {
  console.log(logPrefix(serviceId, type), 'No changes after filtering, did not record version.');
}

export function onChangesPublished() {
  console.log('Changes published');
}

export function onApplicationError(error) {
  console.error('ApplicationError', error);
}

export function onDocumentUpdateError(serviceId, type, error) {
  console.error(logPrefix(serviceId, type), `Could not update document: ${error}`);
}

export function onDocumentFetchError(serviceId, type, error) {
  console.error(logPrefix(serviceId, type), `Could not fetch location: ${error}`);
}

function logPrefix(serviceId, type) {
  return `[${serviceId}-${type}]`;
}
