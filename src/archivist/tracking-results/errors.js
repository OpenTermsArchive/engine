/* eslint-disable max-classes-per-file */ // Grouping the module's error types here is the point of an errors module

export class MissingCollectionIdError extends Error {} // The collection metadata does not provide the id that identifies the collection in every persisted run; tracking-results cannot record without it

export class UnreadableRunError extends Error {} // The persisted run.json cannot be read as a valid Run (corrupted JSON, incompatible schema from another engine version): recovery is impossible by construction, unlike infrastructure failures for which a retry is meaningful
