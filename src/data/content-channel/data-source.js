import { ContentChannel as coreContentChannel } from '@apollosproject/data-connector-rock';
import ApollosConfig from '@apollosproject/config';
import { isEmpty } from 'lodash';

import { isRequired } from '../utils';

const { ROCK_MAPPINGS } = ApollosConfig;

export default class ContentChannel extends coreContentChannel.dataSource {
  getEventChannels = () => {};

  getFromIds = (ids) => this.getContentChannelsFromIds(ids);

  getContentChannelsFromIds = async (ids) => {
    const channels = await this.request()
      .filter(ids.map((channelId) => `(Id eq ${channelId})`).join(' or '))
      .cache({ ttl: 5 })
      .get();

    const sortOrder = ids;
    // Sort order could be undefined or have no ids. There's no reason to iterate in this case.
    if (!sortOrder || isEmpty(sortOrder)) {
      return channels;
    }
    // Setup a result array.
    const result = [];
    sortOrder.forEach((configId) => {
      // Remove the matched element from the channel list.
      const channel = channels.splice(
        channels.findIndex(({ id }) => id === configId),
        1
      );
      // And then push it (or nothing) to the end of the result array.
      result.push(...channel);
    });
    // Return results and any left over channels.
    return [...result, ...channels];
  };

  getFeatures = async (
    contentChannelId = isRequired('ContentChannel.getFeatures', 'contentChannelId')
  ) => {
    if (!contentChannelId) {
      return [];
    }

    const { ContentItem, Person } = this.context.dataSources;
    const contentChannelItems = await this.request('ContentChannelItems')
      .filter(`ContentChannelId eq ${contentChannelId}`)
      .andFilter(ContentItem.LIVE_CONTENT())
      .cache({ ttl: 60 })
      .orderBy('Order', 'asc')
      .get();

    // TODO : remove when this is merged [https://github.com/ApollosProject/apollos-plugin/pull/2]
    const usePersonas = FEATURE_FLAGS.ROCK_DYNAMIC_FEED_WITH_PERSONAS.status === 'LIVE';
    let personas = [];
    if (usePersonas) {
      try {
        personas = await Person.getPersonas({
          categoryId: ROCK_MAPPINGS.DATAVIEW_CATEGORIES.PersonaId,
        });
      } catch (e) {
        console.log('Rock Dynamic Feed: Unable to retrieve personas for user.');
        console.log({ e });
      }
    }

    const filteredContentChannelItems = contentChannelItems.filter((item) => {
      // TODO : remove when this is merged [https://github.com/ApollosProject/apollos-plugin/pull/2]
      const securityDataViews = split(
        get(item, 'attributeValues.securityDataViews.value', ''),
        ','
      ).filter((dv) => !!dv);

      if (securityDataViews.length > 0) {
        const userInSecurityDataViews = personas.filter(({ guid }) =>
          securityDataViews.includes(guid)
        );
        if (userInSecurityDataViews.length === 0) {
          console.log('User does not have access to this item');
          return false;
        }
      }

      return true;
    });

    const { clientVersion } = this.context;
    const versionParse = split(clientVersion, '.').join('');
    const versionNumber = parseInt(versionParse);

    return Promise.all(
      filteredContentChannelItems.map((item) => {
        const action = get(item, 'attributeValues.action.value', '');

        switch (
          action // TODO : support multiple algorithms from Rock
        ) {
          case 'VIEW_CHILDREN': // deprecated, old action
          case 'HeroList':
            return this.createHeroListFeature({
              algorithms: [
                {
                  type: 'CONTENT_CHILDREN',
                  arguments: {
                    contentChannelItemId: item.id,
                  },
                },
              ],
              title: item.title,
              subtitle: ContentItem.createSummary(item),
            });
          case 'DefaultHorizontalCardList':
          case 'HighlightHorizontalCardList':
          case 'HighlightMediumHorizontalCardList':
          case 'HighlightSmallHorizontalCardList':
            /**
             * There was a bug in the Horizontal Card Feed that was resolved
             * in 5.4.0, so in order to help keep this from being an issue,
             * we'll just go ahead and resolve this to a Vertical List for
             * any version less than 5.4.0
             */
            if (versionNumber >= 540) {
              // HorizontalCardList with Card Type override
              const getCardType = () => {
                switch (action) {
                  case 'HighlightHorizontalCardList':
                    return 'HIGHLIGHT';
                  case 'HighlightMediumHorizontalCardList':
                    return 'HIGHLIGHT_MEDIUM';
                  case 'HighlightSmallHorizontalCardList':
                    return 'HIGHLIGHT_SMALL';
                  default:
                    return 'DEFAULT';
                }
              };
              return this.createHorizontalCardListFeature({
                algorithms: [
                  {
                    type: 'CONTENT_CHILDREN',
                    arguments: {
                      contentChannelItemId: item.id,
                    },
                  },
                ],
                title: item.title,
                subtitle: ContentItem.createSummary(item),
                cardType: getCardType(),
              });
            }
          case 'READ_GLOBAL_CONTENT': // deprecated, old action
          case 'VerticalCardList':
          default:
            // VerticalCardList with the CONTENT_CHILDREN as default
            return this.createVerticalCardListFeature({
              algorithms: [
                {
                  type: 'CONTENT_CHILDREN',
                  arguments: {
                    contentChannelItemId: item.id,
                  },
                },
              ],
              title: item.title,
              subtitle: ContentItem.createSummary(item),
            });
        }
      })
    );
  };
}
