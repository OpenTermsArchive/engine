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

const serviceProvidersMailingLists = {};
let serviceProviders;
let documentTypes;

export function init(passedServiceProviders, passedDocumentTypes) {
  serviceProviders = passedServiceProviders;
  documentTypes = passedDocumentTypes;
}

export async function onDocumentScrapingError(serviceProviderId, documentTypeId, error) {
  const sendParams = {
    templateId: ERROR_TEMPLATE_ID,
    params: {
      SERVICE_PROVIDER_NAME: serviceProviders[serviceProviderId].serviceProviderName,
      DOCUMENT_TYPE: documentTypes[documentTypeId].name,
      ERROR_TEXT: `An error has occured when trying to scrape the document:
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

  const sendPromises = [];
  uniqueContacts.forEach(contact => {
    sendPromises.push(apiInstance.sendTransacEmail({
      ...sendParams,
      to: [{ email: contact.email }]
    }));
  });

  return Promise.all(sendPromises);
}

async function getListContacts(listId) {
  let offset = 0;
  let limit = 50;
  const list = await contactsInstance.getList(listId);

  return recursivePaginationAccumulator('getContactsFromList', 'contacts', listId, limit, offset, [], list.totalSubscribers);
}

async function recursivePaginationAccumulator(apiFunctionName, resultKey, resourceId, limit, offset, accumulator, count) {
  if (accumulator.length >= count) {
    return accumulator;
  }

  const result = await contactsInstance[apiFunctionName](resourceId, { limit, offset });
  accumulator = accumulator.concat(result[resultKey]);
  return recursivePaginationAccumulator(apiFunctionName, resultKey, resourceId, limit, offset + limit, accumulator, count);
}
