import config from 'config';
import dotenv from 'dotenv';
import pTimeout from '@lolpants/ptimeout';
import sendInBlue from 'sib-api-v3-sdk';

dotenv.config();
export default class Notifier {
  constructor(passedServiceProviders) {
    const defaultClient = sendInBlue.ApiClient.instance;
    const authentication = defaultClient.authentications['api-key'];
    authentication.apiKey = process.env.SENDINBLUE_API_KEY;

    this.apiInstance = new sendInBlue.SMTPApi();
    this.contactsInstance = new sendInBlue.ContactsApi();

    this.serviceProviders = passedServiceProviders;
    this.delayedVersionNotificationsParams = [];
  }

  async onVersionRecorded(serviceId, type, versionId) {
    this.delayedVersionNotificationsParams.push({ serviceId, type, versionId });
  }

  async onRecordsPublished() {
    for (const { serviceId, type, versionId } of this.delayedVersionNotificationsParams) {
      console.log(
        `notifyVersionRecorded for "${serviceId}" type "${type}" and versionId "${versionId}"`
      );
      try {
        // eslint-disable-next-line
        await pTimeout.default(async () => {
          await this.notifyVersionRecorded(serviceId, type, versionId); // eslint-disable-line
        }, 1 * 10 * 1000);
      } catch (e) {
        console.error(e);
      }
    }

    this.delayedVersionNotificationsParams = [];
  }

  async notifyVersionRecorded(serviceProviderId, documentTypeId, versionId) {
    const sendParams = {
      templateId: config.get('notifier.sendInBlue.updateTemplateId'),
      params: {
        SERVICE_PROVIDER_NAME: this.serviceProviders[serviceProviderId].name,
        DOCUMENT_TYPE: documentTypeId,
        SHA: versionId,
      },
    };

    return this.send(
      [
        config.get('notifier.sendInBlue.administratorsListId'),
        config.get('notifier.sendInBlue.updatesListId'),
      ],
      sendParams
    );
  }

  async send(lists, sendParams) {
    const promises = lists.map((listId) => this.getListContacts(listId));

    let contacts = await Promise.all(promises);

    contacts = contacts.flat();

    const uniqueContacts = [...new Map(contacts.map((item) => [item.id, item])).values()];

    const sendPromises = uniqueContacts.map((contact) =>
      this.apiInstance.sendTransacEmail({ ...sendParams, to: [{ email: contact.email }] }));

    return Promise.all(sendPromises);
  }

  async getListContacts(listId) {
    const list = await this.contactsInstance.getList(listId);

    return this.getAllPaginatedEntries(
      'getContactsFromList',
      listId,
      'contacts',
      [],
      list.totalSubscribers
    );
  }

  async getAllPaginatedEntries(
    functionName,
    resourceIdParameter,
    resultKey,
    accumulator,
    count,
    offset = 0,
    paginationSize = 50
  ) {
    if (accumulator.length >= count) {
      return accumulator;
    }

    const result = await this.contactsInstance[functionName](resourceIdParameter, {
      limit: paginationSize,
      offset,
    });
    accumulator = accumulator.concat(result[resultKey]);
    return this.getAllPaginatedEntries(
      functionName,
      resourceIdParameter,
      resultKey,
      accumulator,
      count,
      offset + paginationSize,
      paginationSize
    );
  }
}
