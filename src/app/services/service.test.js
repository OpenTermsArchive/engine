import chai from 'chai';

import Service from './service.js';
import DocumentDeclaration from './documentDeclaration.js';

const { expect } = chai;

describe('Service', () => {
  describe('#addDocumentDeclaration', () => {
    let subject;

    const lastDeclaration = new DocumentDeclaration({
      type: 'Terms of Service',
      location: 'https://www.service.example/tos',
      contentSelectors: 'body'
    });

    const firstDeclaration = new DocumentDeclaration({
      type: 'Terms of Service',
      location: 'https://www.service.example/terms',
      contentSelectors: 'main',
      validUntil: '2020-07-22T11:30:21.000Z'
    });

    context('with a document declaration without validity date', () => {
      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addDocumentDeclaration(lastDeclaration);
      });

      it('adds the document as the last valid document declaration', async () => {
        expect(subject._documents['Terms of Service']._latest).to.eql(lastDeclaration);
      });

      it('adds no history entries', async () => {
        expect(subject._documents['Terms of Service']._history).to.be.undefined;
      });
    });

    context('with a document declaration with validity date', () => {
      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addDocumentDeclaration(firstDeclaration);
      });

      it('adds no last valid document declaration', async () => {
        expect(subject._documents['Terms of Service']._latest).to.be.undefined;
      });

      it('adds the document in the history', async () => {
        expect(subject._documents['Terms of Service']._history).to.have.members([ firstDeclaration ]);
      });
    });
  });

  describe('#getDocumentDeclaration', () => {
    let subject;
    const lastDeclaration = new DocumentDeclaration({
      type: 'Terms of Service',
      location: 'https://www.service.example/tos',
      contentSelectors: 'body'
    });

    const firstDeclaration = new DocumentDeclaration({
      type: 'Terms of Service',
      location: 'https://www.service.example/terms',
      contentSelectors: 'main',
      validUntil: '2020-07-22T11:30:21.000Z'
    });

    const secondDeclaration = new DocumentDeclaration({
      type: 'Terms of Service',
      location: 'https://www.service.example/terms-of-service',
      contentSelectors: 'main',
      validUntil: '2020-08-22T11:30:21.000Z'
    });

    context('when there is no history', () => {
      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addDocumentDeclaration(lastDeclaration);
      });

      context('without given date', () => {
        it('returns the last document declaration', async () => {
          expect(subject.getDocumentDeclaration('Terms of Service')).to.eql(lastDeclaration);
        });
      });

      context('with a date', () => {
        it('returns the last document declaration', async () => {
          expect(subject.getDocumentDeclaration('Terms of Service', '2020-08-21T11:30:21.000Z')).to.eql(lastDeclaration);
        });
      });
    });

    context('when the document as an history', () => {
      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addDocumentDeclaration(lastDeclaration);
        subject.addDocumentDeclaration(firstDeclaration);
        subject.addDocumentDeclaration(secondDeclaration);
      });

      context('without given date', () => {
        it('returns the last document declaration', async () => {
          expect(subject.getDocumentDeclaration('Terms of Service')).to.eql(lastDeclaration);
        });
      });

      context('with a date', () => {
        it('returns the document declaration according to the given date', async () => {
          expect(subject.getDocumentDeclaration('Terms of Service', '2020-08-21T11:30:21.000Z')).to.eql(secondDeclaration);
        });

        context('strictly equal to a document declaration validity date', () => {
          it('returns the document declaration with the validity date equal to the given date', async () => {
            expect(subject.getDocumentDeclaration('Terms of Service', secondDeclaration.validUntil)).to.eql(secondDeclaration);
          });
        });
      });
    });
  });

  describe('#getDocumentTypes', () => {
    let subject;
    const termsOfServiceDeclaration = new DocumentDeclaration({
      type: 'Terms of Service',
      location: 'https://www.service.example/tos',
      contentSelectors: 'body'
    });

    const privacyPolicyDeclaration = new DocumentDeclaration({
      type: 'Privacy Policy',
      location: 'https://www.service.example/terms',
      contentSelectors: 'main',
      validUntil: '2020-07-22T11:30:21.000Z'
    });

    before(async () => {
      subject = new Service({ id: 'serviceID', name: 'serviceName' });
      subject.addDocumentDeclaration(termsOfServiceDeclaration);
      subject.addDocumentDeclaration(privacyPolicyDeclaration);
    });

    it('returns the service document types', async () => {
      expect(subject.getDocumentTypes()).to.have.members([ termsOfServiceDeclaration.type, privacyPolicyDeclaration.type ]);
    });
  });
});
