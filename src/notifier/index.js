import dotenv from 'dotenv';
import config from 'config';
dotenv.config();

import sendInBlue from 'sib-api-v3-sdk';
export default class Notifier {
  constructor(passedServiceProviders, passedDocumentTypes) {
    const defaultClient = sendInBlue.ApiClient.instance;
    const authentication = defaultClient.authentications['api-key'];
    authentication.apiKey = process.env.SENDINBLUE_API_KEY;

    this.apiInstance = new sendInBlue.SMTPApi();
    this.contactsInstance = new sendInBlue.ContactsApi();

    this.serviceProviders = passedServiceProviders;
    this.documentTypes = passedDocumentTypes;
  }

  async onDocumentFetchError(serviceProviderId, documentTypeId, error) {
    const sendParams = {
      templateId: config.get('notifier.sendInBlue.errorTemplateId'),
      params: {
        SERVICE_PROVIDER_NAME: this.serviceProviders[serviceProviderId].name,
        DOCUMENT_TYPE: this.documentTypes[documentTypeId].name,
        ERROR_TEXT: `An error occured when trying to scrape the document:
  ${error}`
      },
    }

    return this.send([config.get('notifier.sendInBlue.administratorsListId')], sendParams);
  }

  async onVersionRecorded(serviceProviderId, documentTypeId, versionId) {
    const sendParams = {
      templateId: config.get('notifier.sendInBlue.updateTemplateId'),
      params: {
        SERVICE_PROVIDER_NAME: this.serviceProviders[serviceProviderId].name,
        DOCUMENT_TYPE: this.documentTypes[documentTypeId].name,
        SHA: versionId
      },
    }

    return this.send([config.get('notifier.sendInBlue.administratorsListId'), config.get('notifier.sendInBlue.updatesListId')], sendParams);
  }

  async onApplicationError(serviceProviderId, documentTypeId, error) {
    const sendParams = {
      templateId: config.get('notifier.sendInBlue.errorTemplateId'),
      params: {
        SERVICE_PROVIDER_NAME: this.serviceProviders[serviceProviderId].name,
        DOCUMENT_TYPE: this.documentTypes[documentTypeId].name,
        ERROR_TEXT: `An error occured when trying to update the document:
  ${error}`
      },
    }

    return this.send([config.get('notifier.sendInBlue.administratorsListId')], sendParams);
  }

  async send(lists, sendParams) {
    let contacts = [];

    for (let listId of lists) {
      const listContacts = await this.getListContacts(listId);
      contacts = contacts.concat(...listContacts);
    }

    const uniqueContacts = contacts.reduce((acc, current) => acc.find(contact => contact.id === current.id) ? acc : acc.concat([current]), []);

    const sendPromises = uniqueContacts.map(contact => this.apiInstance.sendTransacEmail({...sendParams, to: [{ email: contact.email }] }));

    return Promise.all(sendPromises);
  }

  async getListContacts(listId) {
    const list = await this.contactsInstance.getList(listId);

    return this.getAllPaginatedEntries('getContactsFromList', listId, 'contacts', [], list.totalSubscribers);
  }

  async getAllPaginatedEntries(functionName, resourceIdParameter, resultKey, accumulator, count, offset = 0, paginationSize = 50) {
    if (accumulator.length >= count) {
      return accumulator;
    }

    const result = await this.contactsInstance[functionName](resourceIdParameter, { limit: paginationSize, offset });
    accumulator = accumulator.concat(result[resultKey]);
    return this.getAllPaginatedEntries(functionName, resourceIdParameter, resultKey, accumulator, count, offset + paginationSize, paginationSize);
  }
}
