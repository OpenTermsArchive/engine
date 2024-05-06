import config from 'config';
import sendInBlue from 'sib-api-v3-sdk';

export default class Notifier {
  constructor(passedServiceProviders) {
    const defaultClient = sendInBlue.ApiClient.instance;
    const authentication = defaultClient.authentications['api-key'];

    authentication.apiKey = process.env.SENDINBLUE_API_KEY;

    this.apiInstance = new sendInBlue.TransactionalEmailsApi();
    this.contactsInstance = new sendInBlue.ContactsApi();

    this.serviceProviders = passedServiceProviders;
    this.delayedVersionNotificationsParams = [];
  }

  onVersionRecorded(record) {
    this.delayedVersionNotificationsParams.push(record);
  }

  onTrackingCompleted() {
    this.delayedVersionNotificationsParams.forEach(async ({ serviceId, termsType, id }) => {
      try {
        await this.notifyVersionRecorded(serviceId, termsType, id);
      } catch (error) {
        console.error(`The notification for version ${id} of ${serviceId} — ${termsType} can not be sent:`, error);
      }
    });

    this.delayedVersionNotificationsParams = [];
  }

  async notifyVersionRecorded(serviceProviderId, termsType, versionId) {
    const sendParams = {
      templateId: config.get('notifier.sendInBlue.updateTemplateId'),
      params: {
        SERVICE_PROVIDER_NAME: this.serviceProviders[serviceProviderId].name,
        DOCUMENT_TYPE: termsType,
        SHA: versionId,
      },
    };

    const lists = [
      config.get('notifier.sendInBlue.updatesListId'),
    ];

    const notificationListName = `${this.serviceProviders[serviceProviderId].name} - ${termsType} - Update`;
    const notificationList = await this.searchContactList(notificationListName);

    if (notificationList?.id) {
      lists.push(notificationList.id);
    }

    return this.send(lists, sendParams);
  }

  async send(lists, sendParams) {
    const promises = lists.map(listId => this.getListContacts(listId));

    let contacts = await Promise.all(promises);

    contacts = contacts.flat();

    const uniqueContacts = [...new Map(contacts.map(item => [ item.id, item ])).values()];

    const sendPromises = uniqueContacts.map(contact =>
      this.apiInstance.sendTransacEmail({ ...sendParams, to: [{ email: contact.email }] }));

    return Promise.all(sendPromises);
  }

  async getAllContactLists() {
    const limit = 50;
    const offset = 0;
    const { count, lists } = await this.contactsInstance.getLists({
      limit,
      offset,
    });

    return {
      count,
      lists: await this.getAllPaginatedEntries(
        'getLists',
        undefined,
        'lists',
        lists,
        count,
        offset + limit,
      ),
    };
  }

  async searchContactList(name) {
    const { lists } = await this.getAllContactLists();

    const list = lists.find(list => list.name === name);

    return list;
  }

  async getListContacts(listId) {
    const list = await this.contactsInstance.getList(listId);

    return this.getAllPaginatedEntries(
      'getContactsFromList',
      listId,
      'contacts',
      [],
      list.totalSubscribers,
    );
  }

  async getAllPaginatedEntries(
    functionName,
    resourceIdParameter,
    resultKey,
    accumulator,
    count,
    offset = 0,
    paginationSize = 50,
  ) {
    if (accumulator.length >= count) {
      return accumulator;
    }

    const promise = resourceIdParameter
      ? this.contactsInstance[functionName](resourceIdParameter, {
        limit: paginationSize,
        offset,
      })
      : this.contactsInstance[functionName](paginationSize, offset);

    const result = await promise;

    accumulator = accumulator.concat(result[resultKey]);

    return this.getAllPaginatedEntries(
      functionName,
      resourceIdParameter,
      resultKey,
      accumulator,
      count,
      offset + paginationSize,
      paginationSize,
    );
  }
}
