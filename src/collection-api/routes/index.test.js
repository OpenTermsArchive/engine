import { expect } from 'chai';
import config from 'config';
import express from 'express';
import sinon from 'sinon';
import supertest from 'supertest';

import apiRouter from './index.js';

const BASE_PATH = '/v1';

describe('API router', () => {
  context('when tracking-results is disabled', () => {
    let request;

    before(async () => {
      const getConfig = config.get.bind(config);

      sinon.stub(config, 'get').callsFake(key => (key === '@opentermsarchive/engine.tracking-results' ? null : getConfig(key)));

      try {
        request = supertest(express().use(BASE_PATH, await apiRouter(BASE_PATH)));
      } finally {
        config.get.restore();
      }
    });

    it('does not expose the tracking results', async () => {
      expect((await request.get(`${BASE_PATH}/tracking-results`)).status).to.equal(404);
    });

    it('does not expose the tracking run', async () => {
      expect((await request.get(`${BASE_PATH}/tracking-results/run`)).status).to.equal(404);
    });

    it('exposes the other endpoints', async () => {
      expect((await request.get(`${BASE_PATH}/services`)).status).to.equal(200);
    });
  });
});
