import chai from 'chai';

import DocumentDeclaration from './documentDeclaration.js';
import Service from './service.js';

const { expect } = chai;

describe('Service', () => {
  let subject;
  const DOCUMENT_TYPE = 'Terms of Service';

  describe('#addDocumentDeclaration', () => {
    let documentDeclaration;

    before(async () => {
      documentDeclaration = new DocumentDeclaration({
        type: DOCUMENT_TYPE,
        service: subject,
        pages: [{
          location: 'https://www.service.example/tos',
          contentSelectors: 'body',
        }],
      });
    });

    context('when document declaration has no validity date', () => {
      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addDocumentDeclaration(documentDeclaration);
      });

      it('adds the document as the last valid document declaration', async () => {
        expect(subject.getDocumentDeclaration(DOCUMENT_TYPE)).to.deep.eql(documentDeclaration);
      });
    });

    context('when document declaration has a validity date', () => {
      let expiredDocumentDeclaration;
      const VALIDITY_DATE = new Date('2020-07-22T11:30:21.000Z');

      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        expiredDocumentDeclaration = new DocumentDeclaration({
          type: 'Terms of Service',
          service: subject,
          validUntil: VALIDITY_DATE,
          pages: [{
            location: 'https://www.service.example/terms',
            contentSelectors: 'main',
          }],
        });
        subject.addDocumentDeclaration(expiredDocumentDeclaration);
        subject.addDocumentDeclaration(documentDeclaration);
      });

      it('adds the document with the proper validity date', async () => {
        expect(subject.getDocumentDeclaration(DOCUMENT_TYPE, VALIDITY_DATE)).to.deep.eql(expiredDocumentDeclaration);
      });
    });
  });

  describe('#getDocumentDeclaration', () => {
    let subject;

    const lastDeclaration = new DocumentDeclaration({
      type: 'Terms of Service',
      location: 'https://www.service.example/tos',
      contentSelectors: 'body',
    });

    context('when there is no history', () => {
      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addDocumentDeclaration(lastDeclaration);
      });

      context('without given date', () => {
        it('returns the last document declaration', async () => {
          expect(subject.getDocumentDeclaration(DOCUMENT_TYPE)).to.eql(lastDeclaration);
        });
      });

      context('with a date', () => {
        it('returns the last document declaration', async () => {
          expect(subject.getDocumentDeclaration(DOCUMENT_TYPE, '2020-08-21T11:30:21.000Z')).to.eql(lastDeclaration);
        });
      });
    });

    context('when the document has a history', () => {
      const firstDeclaration = new DocumentDeclaration({
        type: 'Terms of Service',
        location: 'https://www.service.example/terms',
        contentSelectors: 'main',
        validUntil: '2020-07-22T11:30:21.000Z',
      });

      const secondDeclaration = new DocumentDeclaration({
        type: 'Terms of Service',
        location: 'https://www.service.example/terms-of-service',
        contentSelectors: 'main',
        validUntil: '2020-08-22T11:30:21.000Z',
      });

      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addDocumentDeclaration(lastDeclaration);
        subject.addDocumentDeclaration(firstDeclaration);
        subject.addDocumentDeclaration(secondDeclaration);
      });

      context('without given date', () => {
        it('returns the last document declaration', async () => {
          expect(subject.getDocumentDeclaration(DOCUMENT_TYPE)).to.eql(lastDeclaration);
        });
      });

      context('with a date', () => {
        it('returns the document declaration according to the given date', async () => {
          expect(subject.getDocumentDeclaration(DOCUMENT_TYPE, '2020-08-21T11:30:21.000Z')).to.eql(secondDeclaration);
        });

        context('strictly equal to a document declaration validity date', () => {
          it('returns the document declaration with the validity date equal to the given date', async () => {
            expect(subject.getDocumentDeclaration(DOCUMENT_TYPE, secondDeclaration.validUntil)).to.eql(secondDeclaration);
          });
        });
      });
    });
  });

  describe('#getDocumentTypes', () => {
    let subject;
    let termsOfServiceDeclaration;
    let privacyPolicyDeclaration;

    before(async () => {
      subject = new Service({ id: 'serviceID', name: 'serviceName' });

      termsOfServiceDeclaration = new DocumentDeclaration({
        type: 'Terms of Service',
        location: 'https://www.service.example/tos',
        contentSelectors: 'body',
      });

      privacyPolicyDeclaration = new DocumentDeclaration({
        type: 'Privacy Policy',
        location: 'https://www.service.example/terms',
        contentSelectors: 'main',
        validUntil: '2020-07-22T11:30:21.000Z',
      });

      subject.addDocumentDeclaration(termsOfServiceDeclaration);
      subject.addDocumentDeclaration(privacyPolicyDeclaration);
    });

    it('returns the service document types', async () => {
      expect(subject.getDocumentTypes()).to.have.members([
        termsOfServiceDeclaration.type,
        privacyPolicyDeclaration.type,
      ]);
    });
  });
});
