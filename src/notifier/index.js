import dotenv from 'dotenv';
import config from 'config';
dotenv.config();

import sendInBlue from 'sib-api-v3-sdk';
const defaultClient = sendInBlue.ApiClient.instance;

const authentication = defaultClient.authentications['api-key'];
authentication.apiKey = process.env.SENDINBLUE_API_KEY;

const apiInstance = new sendInBlue.SMTPApi();
const contactsInstance = new sendInBlue.ContactsApi();

const ADMINISTRATORS_LIST_ID = config.get('notifier.sendInBlue.administratorsListId');
const UPDATES_LIST_ID = config.get('notifier.sendInBlue.updatesListId');
const UPDATE_TEMPLATE_ID = config.get('notifier.sendInBlue.updateTemplateId');
const ERROR_TEMPLATE_ID = config.get('notifier.sendInBlue.errorTemplateId');
const BASE_URL = config.get('notifier.sendInBlue.baseUrl');

let serviceProviders;
let documentTypes;

export async function init(passedServiceProviders, passedDocumentTypes) {
  serviceProviders = passedServiceProviders;
  documentTypes = passedDocumentTypes;
}

export async function onDocumentScrapingError(serviceProviderId, documentTypeId, error) {
  const sendParams = {
    templateId: ERROR_TEMPLATE_ID,
    params: {
      SERVICE_PROVIDER_NAME: serviceProviders[serviceProviderId].serviceProviderName,
      DOCUMENT_TYPE: documentTypes[documentTypeId].name,
      ERROR_TEXT: `An error occured when trying to scrape the document:
${error}`
    },
  }

  return send([ADMINISTRATORS_LIST_ID], sendParams);
}

export async function onSanitizedDocumentChange(serviceProviderId, documentTypeId, sanitizedSha) {
  const sendParams = {
    templateId: UPDATE_TEMPLATE_ID,
    params: {
      SERVICE_PROVIDER_NAME: serviceProviders[serviceProviderId].serviceProviderName,
      DOCUMENT_TYPE: documentTypes[documentTypeId].name,
      URL: `${BASE_URL}${sanitizedSha}`
    },
  }

  return send([ADMINISTRATORS_LIST_ID, UPDATES_LIST_ID], sendParams);
};

export async function onApplicationError(serviceProviderId, documentTypeId, error) {
  const sendParams = {
    templateId: ERROR_TEMPLATE_ID,
    params: {
      SERVICE_PROVIDER_NAME: serviceProviders[serviceProviderId].serviceProviderName,
      DOCUMENT_TYPE: documentTypes[documentTypeId].name,
      ERROR_TEXT: `An error has occured when trying to update the document:
${error}`
    },
  }

  return send([ADMINISTRATORS_LIST_ID], sendParams);
}

async function send(lists, sendParams) {
  let contacts = [];

  for (let listId of lists) {
    const listContacts = await getListContacts(listId);
    contacts = contacts.concat(...listContacts);
  }

  const uniqueContacts = contacts.reduce((acc, current) => acc.find(contact => contact.id === current.id) ? acc : acc.concat([current]), []);

  const sendPromises = uniqueContacts.map(contact => apiInstance.sendTransacEmail({...sendParams, to: [{ email: contact.email }] }));

  return Promise.all(sendPromises);
}

async function getListContacts(listId) {
  const list = await contactsInstance.getList(listId);

  return getAllPaginatedEntries('getContactsFromList', listId, 'contacts', [], list.totalSubscribers);
}

async function getAllPaginatedEntries(functionName, resourceIdParameter, resultKey, accumulator, count, offset = 0, paginationSize = 50) {
  if (accumulator.length >= count) {
    return accumulator;
  }

  const result = await contactsInstance[functionName](resourceIdParameter, { limit: paginationSize, offset });
  accumulator = accumulator.concat(result[resultKey]);
  return getAllPaginatedEntries(functionName, resourceIdParameter, resultKey, accumulator, count, offset + paginationSize, paginationSize);
}
