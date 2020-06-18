import dotenv from 'dotenv';
dotenv.config();

import sendInBlue from 'sib-api-v3-sdk';
const defaultClient = sendInBlue.ApiClient.instance;

const authentication = defaultClient.authentications['api-key'];
authentication.apiKey = process.env.SENDINBLUE_API_KEY;

const apiInstance = new sendInBlue.SMTPApi();
const contactsInstance = new sendInBlue.ContactsApi();

const LIST_FOLDER_ID = Number.parseInt(process.env.NODE_ENV === 'test' ? process.env.LIST_TEST_FOLDER_ID : process.env.LIST_FOLDER_ID, 10);
const UPDATE_TEMPLATE_ID = Number.parseInt(process.env.UPDATE_TEMPLATE_ID, 10);
const ERROR_TEMPLATE_ID = Number.parseInt(process.env.ERROR_TEMPLATE_ID, 10);
const BASE_URL = process.env.BASE_URL;

const serviceProvidersMailingLists = {};
let serviceProviders;
let documentTypes;

let initialized = false;
export async function init(passedServiceProviders, passedDocumentTypes) {
  if (!initialized) {
    serviceProviders = passedServiceProviders;
    documentTypes = passedDocumentTypes;
    return bootstrapMailingLists().then(() => {
      initialized = true;
    });
  }

  return Promise.resolve();
}

async function bootstrapMailingLists() {
  const listsPromises = [];

  Object.keys(serviceProviders).forEach((serviceProviderId) => {
    const { documents, serviceProviderName } = serviceProviders[serviceProviderId];

    serviceProvidersMailingLists[serviceProviderId] = {};

    listsPromises.push(generateServiceProviderList({ serviceProviderName, serviceProviderId }));

    Object.keys(documents).forEach((documentId) => {
      listsPromises.push(generateDocumentsLists({
        serviceProviderName,
        serviceProviderId,
        documentName: documentTypes[documentId].name,
        documentId,
      }));
    });
  });

  return Promise.all(listsPromises);
}

async function generateServiceProviderList({ serviceProviderName, serviceProviderId }) {
  const baseListId = await createListIfNotExists(serviceProviderName);

  serviceProvidersMailingLists[serviceProviderId].baseListId = baseListId;
}

async function generateDocumentsLists({ serviceProviderName, serviceProviderId, documentName, documentId }) {
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

export function onRawDocumentChange() {
  //noop;
};

export async function onDocumentScrappingError(serviceProviderId, documentTypeId, error) {
  const sendParams = {
    templateId: ERROR_TEMPLATE_ID,
    params: {
      "SERVICE_PROVIDER_NAME": serviceProviders[serviceProviderId].serviceProviderName,
      "DOCUMENT_TYPE": documentTypes[documentTypeId].name,
      "ERROR_TEXT": `An error has occured when trying to scrape the document:
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
      "SERVICE_PROVIDER_NAME": serviceProviders[serviceProviderId].serviceProviderName,
      "DOCUMENT_TYPE": documentTypes[documentTypeId].name,
      "URL": `${BASE_URL}${sanitizedSha}`
    },
  }

  return send([
    serviceProvidersMailingLists[serviceProviderId].baseListId,
    serviceProvidersMailingLists[serviceProviderId][documentTypeId].updateListId
  ], sendParams);
};

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

export async function deleteList(listId) {
  return contactsInstance.deleteList(listId);
}

async function getListContacts(listId) {
  let offset = 0;
  let limit = 50;
  const list = await contactsInstance.getList(listId);

  return _aggregate('getContactsFromList', 'contacts', listId, limit, offset, [], list.totalSubscribers);
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

  return _aggregate('getFolderLists', 'lists', folderId, limit, offset + limit, [...lists], count);
}

async function _aggregate(functionName, resultKey, resourceId, limit, offset, aggregator, count) {
  if (aggregator.length >= count) {
    return aggregator;
  }

  const result = await contactsInstance[functionName](resourceId, { limit, offset });
  aggregator = aggregator.concat(result[resultKey]);
  return _aggregate(functionName, resultKey, resourceId, limit, offset + limit, aggregator, count);
}

export function getServiceProvidersMailingLists() {
  return serviceProvidersMailingLists;
}
