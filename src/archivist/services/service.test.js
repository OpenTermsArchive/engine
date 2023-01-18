import chai from 'chai';

import DocumentDeclaration from './documentDeclaration.js';
import Service from './service.js';

const { expect } = chai;

describe('Service', () => {
  let subject;
  const TERMS_TYPE = 'Terms of Service';

  describe('#addDocumentDeclaration', () => {
    let documentDeclaration;

    before(async () => {
      documentDeclaration = new DocumentDeclaration({
        termsType: TERMS_TYPE,
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
        expect(subject.getDocumentDeclaration(TERMS_TYPE)).to.deep.eql(documentDeclaration);
      });
    });

    context('when document declaration has a validity date', () => {
      let expiredDocumentDeclaration;
      const VALIDITY_DATE = new Date('2020-07-22T11:30:21.000Z');

      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        expiredDocumentDeclaration = new DocumentDeclaration({
          termsType: TERMS_TYPE,
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
        expect(subject.getDocumentDeclaration(TERMS_TYPE, VALIDITY_DATE)).to.deep.eql(expiredDocumentDeclaration);
      });
    });
  });

  describe('#getDocumentDeclaration', () => {
    let subject;

    const lastDeclaration = new DocumentDeclaration({
      termsType: TERMS_TYPE,
      pages: [{
        location: 'https://www.service.example/tos',
        contentSelectors: 'body',
      }],
    });

    context('when there is no history', () => {
      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addDocumentDeclaration(lastDeclaration);
      });

      context('without given date', () => {
        it('returns the last document declaration', async () => {
          expect(subject.getDocumentDeclaration(TERMS_TYPE)).to.eql(lastDeclaration);
        });
      });

      context('with a date', () => {
        it('returns the last document declaration', async () => {
          expect(subject.getDocumentDeclaration(TERMS_TYPE, '2020-08-21T11:30:21.000Z')).to.eql(lastDeclaration);
        });
      });
    });

    context('when the document has a history', () => {
      const firstDeclaration = new DocumentDeclaration({
        termsType: TERMS_TYPE,
        validUntil: '2020-07-22T11:30:21.000Z',
        pages: [{
          location: 'https://www.service.example/terms',
          contentSelectors: 'main',
        }],
      });

      const secondDeclaration = new DocumentDeclaration({
        termsType: TERMS_TYPE,
        validUntil: '2020-08-22T11:30:21.000Z',
        pages: [{
          location: 'https://www.service.example/terms-of-service',
          contentSelectors: 'main',
        }],
      });

      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addDocumentDeclaration(lastDeclaration);
        subject.addDocumentDeclaration(firstDeclaration);
        subject.addDocumentDeclaration(secondDeclaration);
      });

      context('without given date', () => {
        it('returns the last document declaration', async () => {
          expect(subject.getDocumentDeclaration(TERMS_TYPE)).to.eql(lastDeclaration);
        });
      });

      context('with a date', () => {
        it('returns the document declaration according to the given date', async () => {
          expect(subject.getDocumentDeclaration(TERMS_TYPE, '2020-08-21T11:30:21.000Z')).to.eql(secondDeclaration);
        });

        context('strictly equal to a document declaration validity date', () => {
          it('returns the document declaration with the validity date equal to the given date', async () => {
            expect(subject.getDocumentDeclaration(TERMS_TYPE, secondDeclaration.validUntil)).to.eql(secondDeclaration);
          });
        });
      });
    });
  });

  describe('#getTermsTypes', () => {
    let subject;
    let termsOfServiceDeclaration;
    let privacyPolicyDeclaration;

    before(async () => {
      subject = new Service({ id: 'serviceID', name: 'serviceName' });

      termsOfServiceDeclaration = new DocumentDeclaration({
        termsType: TERMS_TYPE,
        pages: [{
          location: 'https://www.service.example/tos',
          contentSelectors: 'body',
        }],
      });

      privacyPolicyDeclaration = new DocumentDeclaration({
        termsType: 'Privacy Policy',
        validUntil: '2020-07-22T11:30:21.000Z',
        pages: [{
          location: 'https://www.service.example/terms',
          contentSelectors: 'main',
        }],
      });

      subject.addDocumentDeclaration(termsOfServiceDeclaration);
      subject.addDocumentDeclaration(privacyPolicyDeclaration);
    });

    it('returns the service terms types', async () => {
      expect(subject.getTermsTypes()).to.have.members([
        termsOfServiceDeclaration.termsType,
        privacyPolicyDeclaration.termsType,
      ]);
    });
  });
});
