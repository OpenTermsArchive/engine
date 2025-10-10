import { expect } from 'chai';
import { loadSnapshots } from '../src/archivist/recorder/snapshot.js';

describe("Snapshots", () => {
  it("should skip snapshots from deleted services", async () => {
    let error;
    try {
      await loadSnapshots();
    } catch (e) {
      error = e;
    }

    expect(error).to.be.undefined;
  });
});
