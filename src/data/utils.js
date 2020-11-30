import URL from 'url';
import ApollosConfig from '@apollosproject/config';
import { createGlobalId } from '@apollosproject/server-core';
import { Utils } from '@apollosproject/data-connector-rock';
import { get, last, dropRight } from 'lodash';

import CHRISTMAS_DEVO_IDS from './christmas-devo';

/*
 Splits up a Rock Key Value paired string where | splits pairs and ^ splits key and value
 Returns null if keyValueStr is null */
export const parseRockKeyValuePairs = (
  keyValueStr,
  keyOverride = null,
  valueOverride = null
) => {
  const key = keyOverride || 'key';
  const value = valueOverride || 'value';

  return keyValueStr
    ? keyValueStr.split('|').map((n) => {
        const splt = n.split('^');
        let rtn = {};

        rtn[key] = splt[0] || '';
        rtn[value] = splt[1] || '';

        return rtn;
      })
    : [];
};

/*
  Parses an identifier to find if it's a Guid or Int or Custom identifier
  If Guid or Int, the object will return a suggested REST query for the identifier */
export const getIdentifierType = (identifier) => {
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const intRegex = /\D/g;
  const stringId = identifier.toString();

  if (stringId.match(guidRegex)) {
    return { type: 'guid', value: identifier, query: `Guid eq (guid'${identifier}')` };
  } else if (!stringId.match(intRegex)) {
    return { type: 'int', value: identifier, query: `Id eq ${identifier}` };
  }

  return { type: 'custom', value: identifier, query: null };
};

/*
  Accepts a GUID for a video file, then creates the appropriate uri endpoint
  for the video file */
// export const createVideoUrlFromGuid = (uri) => uri
export const createVideoUrlFromGuid = (uri) =>
  uri.startsWith('http')
    ? Utils.enforceProtocol(uri)
    : `${ApollosConfig.ROCK.FILE_URL}?guid=${uri}`;

/*
  Accepts a string url that is read and determined if a deep link can be
  generated for it. If it can, an updated url will be created and returned
  back to the client.

  NOTE: it is assumed that the client requesting this update is a mobile app
        so that a deep link url can be created. Web apps should not use this */
const contentSingleTag = (strings, id) =>
  `christfellowship://c/ContentSingle?itemId=${strings[0]}${id}`;
const contentFeedTag = (strings, id) =>
  `christfellowship://c/ContentFeed?itemId=${strings[0]}${id}&nested=true`;
export const generateAppLinkFromUrl = async (uri, context) => {
  const externalLinks = [
    'cf.church/pushpay',
    'cf.church/paypal',
    'cf.church/venmo',
    'cf.church/cash-app',
  ];
  const parsedUrl = URL.parse(uri);
  const host = parsedUrl.host;

  if (host === 'christfellowship.church') {
    // Remove the first instance of / (/content/title-${itemId}) so that our array
    //  after the split is ['content', 'title-${itemId}']
    const pathParts = parsedUrl.pathname.replace('/', '').split('/');

    /**
     * Temp logic for Christmas Devotional
     *
     * Regex pattern : - day1, day2, day3, etc. (day + integer)
     */
    if (pathParts.length === 1) {
      const regex = /(day)\d+/g;
      const christmasUrl = pathParts[0].match(regex);

      if (christmasUrl.length > 0) {
        const itemId = CHRISTMAS_DEVO_IDS[pathParts];
        return contentSingleTag`DevotionalContentItem:${itemId}`;
      }
    }

    if (pathParts.length > 1) {
      // For Content Single
      const pathWithoutId = dropRight(pathParts);
      const id = last(last(pathParts).split('-'));
      switch (pathWithoutId.join('/')) {
        case 'content':
          return contentSingleTag`UniversalContentItem:${id}`;
        case 'items':
          return contentSingleTag`InformationalContentItem:${id}`;
        case 'events':
          const { dataSources } = context;
          const contentItem = await dataSources.ContentItem.getEventByTitle(pathParts[1]);
          const eventId = get(contentItem, 'id');
          if (eventId) {
            return contentSingleTag`${createGlobalId(eventId, 'EventContentItem')}`;
          }
        case 'content/collection':
          return contentFeedTag`UniversalContentItem:${id}`;
      }
    }
  } else if (
    host === 'pushpay.com' ||
    externalLinks.includes(`${parsedUrl.host}${parsedUrl.pathname}`)
  ) {
    return `${parsedUrl.protocol}//${parsedUrl.host}${
      parsedUrl.pathname
    }?mobileApp=external&${parsedUrl.query || ''}`;
  }

  console.log('defualt');
  return uri;
};
