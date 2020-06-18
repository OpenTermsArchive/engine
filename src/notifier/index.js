import dotenv from 'dotenv';
dotenv.config();

import sendInBlue from 'sib-api-v3-sdk';
const defaultClient = sendInBlue.ApiClient.instance;

const authentication = defaultClient.authentications['api-key'];
authentication.apiKey = process.env.SENDINBLUE_API_KEY;

const apiInstance = new sendInBlue.SMTPApi();
const contactsInstance = new sendInBlue.ContactsApi();

const LIST_FOLDER_ID = 44;
const serviceProvidersMailingLists = {};

let initialized = false;
export async function init(serviceProviders, documentTypes) {
  if (!initialized) {
    return bootstrapMailingLists(serviceProviders, documentTypes).then(() => {
      initialized = true;
    });
  }

  return Promise.resolve();
}

async function bootstrapMailingLists(serviceProviders, documentTypes) {
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

export async function onSanitizedDocumentChange() {
  //noop;
  console.log('TODO: Notify sanitized document changed');
};

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
  const list = await contactsInstance.getList(listId);

  let offset = 0;
  let limit = 1;
  return _getListContacts(listId, limit, offset, [], list.totalSubscribers);
}

async function _getListContacts(listId, limit, offset, contactsAggregator, contactsTotal) {
  if (contactsAggregator.length === contactsTotal) {
    return contactsAggregator;
  }

  const { contacts } = await contactsInstance.getContactsFromList(listId, { limit, offset });
  contactsAggregator = contactsAggregator.concat(contacts);

  return _getListContacts(listId, limit, offset + limit, contactsAggregator, contactsTotal);
}

export async function getFolderLists(folderId) {
  let offset = 0;
  let limit = 20;
  const { lists, count } = await contactsInstance.getFolderLists(folderId, {
    limit,
    offset
  });

  if (!lists) {
    return [];
  }

  return _getFolderList(folderId, limit, offset + limit, [...lists], count);
}

async function _getFolderList(folderId, limit, offset, aggregator, count) {
  if (aggregator.length >= count) {
    return aggregator;
  }

  const { lists } = await contactsInstance.getFolderLists(folderId, { limit, offset });
  aggregator = aggregator.concat(lists);

  return _getFolderList(folderId, limit, offset + limit, aggregator, count);
}
