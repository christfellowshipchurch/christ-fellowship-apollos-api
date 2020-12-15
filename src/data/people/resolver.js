import { Person as corePerson } from '@apollosproject/data-connector-rock';
import { resolverMerge, withEdgePagination } from '@apollosproject/server-core';
import ApollosConfig from '@apollosproject/config';
import { get, filter, find, difference } from 'lodash';
import { Utils } from '@apollosproject/data-connector-rock';
import { rockImageUrl } from '../utils';

const { enforceCurrentUser } = Utils;

const resolver = {
  Person: {
    address: (root, args, { dataSources }) => dataSources.Address.getByUser(),
    communicationPreferences: ({ emailPreference }, args, { dataSources }) => ({
      allowSMS: async () => {
        const phoneNumber = await dataSources.PhoneNumber.getByUser();

        return phoneNumber ? get(phoneNumber, 'isMessagingEnabled', false) : false;
      },
      allowEmail: emailPreference < 2,
      allowPushNotifications: null,
    }),
    baptismDate: enforceCurrentUser(({ id }, args, { dataSources }) =>
      dataSources.Person.getAttributeByKey({
        personId: id,
        key: get(ApollosConfig, 'ROCK_MAPPINGS.PERSON_ATTRIBUTES.BAPTISM_DATE'),
      })
    ),
    ethnicity: enforceCurrentUser(({ id }, args, { dataSources }) =>
      dataSources.Person.getAttributeByKey({
        personId: id,
        key: get(ApollosConfig, 'ROCK_MAPPINGS.PERSON_ATTRIBUTES.ETHNICITY'),
      })
    ),
    groups: enforceCurrentUser(({ id }, { input }, { dataSources }) => {
      const { Group } = dataSources;
      let args = { personId: id };

      if (input) {
        const include = get(input, 'includeTypes', []);
        const exclude = get(input, 'excludeTypes', []);

        /**
         * Respect the include before the exclude
         *
         * TODO : respect a combination of both include and exclude... maybe?
         */
        if (include.length) {
          args.groupTypeIds = Object.keys(Group.groupTypeMap)
            .filter((key) => include.includes(key))
            .map((key) => Group.groupTypeMap[key]);
        } else if (exclude.length) {
          args.groupTypeIds = Object.keys(Group.groupTypeMap)
            .filter((key) => !exclude.includes(key))
            .map((key) => Group.groupTypeMap[key]);
        }

        args.asLeader = get(input, 'asLeader', false);
      }

      return Group.getByPerson(args);
    }),
    phoneNumber: enforceCurrentUser(async ({ id }, args, { dataSources }) => {
      const phoneNumber = await dataSources.PhoneNumber.getByUser();

      return phoneNumber ? get(phoneNumber, 'number', '') : '';
    }),
    photo: (root, args, { dataSources }) => {
      const guid = get(root, 'photo.guid');

      return {
        uri: rockImageUrl(
          guid && guid !== '' ? guid : '0ad7f78a-1e6b-46ad-a8be-baa0dbaaba8e',
          {
            h: 150,
            w: 150,
            format: 'jpg',
            quality: 70,
          }
        ),
      };
    },
    salvationDate: enforceCurrentUser(({ id }, args, { dataSources }) =>
      dataSources.Person.getAttributeByKey({
        personId: id,
        key: get(ApollosConfig, 'ROCK_MAPPINGS.PERSON_ATTRIBUTES.SALVATION_DATE'),
      })
    ),
  },
  PeopleConnection: {
    totalCount: ({ getTotalCount }) => getTotalCount(),
    pageInfo: withEdgePagination,
  },
  Query: {
    getEthnicityList: (root, args, { dataSources }) =>
      dataSources.DefinedValueList.getByIdentifier(
        get(ApollosConfig, 'ROCK_MAPPINGS.DEFINED_TYPES.ETHNICITY')
      ),
    getSpouse: (root, args, { dataSources }) => dataSources.Person.getSpouseByUser(),
    getChildren: (root, args, { dataSources }) => dataSources.Person.getChildrenByUser(),
  },
  Mutation: {
    updateAddress: (root, { address }, { dataSources }) =>
      dataSources.Address.updateByUser(address),
    updateProfileField: async (root, { input: { field, value } }, { dataSources }) => {
      if (field === 'PhoneNumber') {
        await dataSources.PhoneNumber.updateByUser(value);
        return dataSources.Auth.getCurrentPerson();
      } else {
        return dataSources.Person.updateProfileWithAttributes([{ field, value }]);
      }
    },
    updateProfileFields: async (root, { input }, { dataSources }) => {
      const otherFields = filter(input, (n) => n.field !== 'PhoneNumber');
      const phoneNumber = find(input, (n) => n.field === 'PhoneNumber');

      await Promise.all([
        otherFields.length
          ? dataSources.Person.updateProfileWithAttributes(otherFields)
          : () => {},
        get(phoneNumber, 'value', '') !== ''
          ? dataSources.PhoneNumber.updateByUser(phoneNumber.value)
          : () => {},
      ]);

      return dataSources.Auth.getCurrentPerson();
    },
    updateCommunicationPreference: (root, { type, allow }, { dataSources }) =>
      dataSources.Person.updateCommunicationPreference({ type, allow }),
    updateCommunicationPreferences: async (root, { input }, { dataSources }) => {
      await Promise.all(
        input.map(({ type, allow }) =>
          dataSources.Person.updateCommunicationPreference({ type, allow })
        )
      );

      return await dataSources.Auth.getCurrentPerson();
    },
    submitRsvp: (root, { input }, { dataSources }) =>
      dataSources.Person.submitRsvp(input),
    submitEmailCapture: (root, { input }, { dataSources }) =>
      dataSources.Person.submitEmailCapture(input),
  },
};

export default resolverMerge(resolver, corePerson);
