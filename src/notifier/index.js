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
const LIST_FOLDER_ID = config.get('notifier.sendInBlue.listFolderId');
const UPDATE_TEMPLATE_ID = config.get('notifier.sendInBlue.updateTemplateId');
const ERROR_TEMPLATE_ID = config.get('notifier.sendInBlue.errorTemplateId');
const BASE_URL = config.get('notifier.sendInBlue.baseUrl');

const serviceProvidersMailingLists = {};
let serviceProviders;
let documentTypes;

let initialized;
export async function init(passedServiceProviders, passedDocumentTypes) {
  if (!initialized) {
    serviceProviders = passedServiceProviders;
    documentTypes = passedDocumentTypes;
    return bootstrapMailingLists().then(() => {
      initialized = Promise.resolve();
    });
  }

  return initialized;
}

async function bootstrapMailingLists() {
  const listsPromises = [];

  Object.keys(serviceProviders).forEach((serviceProviderId) => {
    const { documents, serviceProviderName } = serviceProviders[serviceProviderId];

    serviceProvidersMailingLists[serviceProviderId] = {};

    listsPromises.push(generateServiceProviderMailingList({ serviceProviderName, serviceProviderId }));

    Object.keys(documents).forEach((documentId) => {
      listsPromises.push(generateDocumentsMailingLists({
        serviceProviderName,
        serviceProviderId,
        documentName: documentTypes[documentId].name,
        documentId,
      }));
    });
  });

  return Promise.all(listsPromises);
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

  return send([
    serviceProvidersMailingLists[serviceProviderId].baseListId,
    serviceProvidersMailingLists[serviceProviderId][documentTypeId].errorListId
  ], sendParams);
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

  return send([
    serviceProvidersMailingLists[serviceProviderId].baseListId,
    serviceProvidersMailingLists[serviceProviderId][documentTypeId].updateListId
  ], sendParams);
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
  const sendPromises = [];

  lists.forEach(async listId => {
    const listContacts = await getListContacts(listId);
    if (listContacts.length) {
      sendPromises.push(apiInstance.sendTransacEmail({
        ...sendParams,
        to: listContacts.map(contact => ({ email: contact.email }))
      }));
    }
  });

  return Promise.all(sendPromises);
}

async function generateServiceProviderMailingList({ serviceProviderName, serviceProviderId }) {
  const baseListId = await createListIfNotExists(serviceProviderName);

  serviceProvidersMailingLists[serviceProviderId].baseListId = baseListId;
}

async function generateDocumentsMailingLists({ serviceProviderName, serviceProviderId, documentName, documentId }) {
  const baseListName = `${serviceProviderName} ${documentName}`;
  const updateListName = `${baseListName} update`;
  const errorListName = `${baseListName} error`;
  const updateListId = await createListIfNotExists(updateListName);
  const errorListId = await createListIfNotExists(errorListName);

  serviceProvidersMailingLists[serviceProviderId][documentId] = {
    updateListId,
    errorListId
  };
}

export async function createListIfNotExists(listName) {
  const lists = await getFolderLists(LIST_FOLDER_ID);

  const existingList = lists && lists.find(list => list.name === listName);
  if (existingList) {
    return existingList.id;
  }

  const list = await contactsInstance.createList({
    name: listName,
    folderId: LIST_FOLDER_ID,
  });
  return list.id;
}

async function getListContacts(listId) {
  let offset = 0;
  let limit = 50;
  const list = await contactsInstance.getList(listId);

  return recursivePaginationAccumulator('getContactsFromList', 'contacts', listId, limit, offset, [], list.totalSubscribers);
}

export async function getFolderLists(folderId) {
  let offset = 0;
  let limit = 50;

  const { lists, count } = await contactsInstance.getFolderLists(folderId, {
    limit,
    offset
  });

  if (!lists) {
    return [];
  }

  return recursivePaginationAccumulator('getFolderLists', 'lists', folderId, limit, offset + limit, [...lists], count);
}

async function recursivePaginationAccumulator(apiFunctionName, resultKey, resourceId, limit, offset, accumulator, count) {
  if (accumulator.length >= count) {
    return accumulator;
  }

  const result = await contactsInstance[apiFunctionName](resourceId, { limit, offset });
  accumulator = accumulator.concat(result[resultKey]);
  return recursivePaginationAccumulator(apiFunctionName, resultKey, resourceId, limit, offset + limit, accumulator, count);
}
