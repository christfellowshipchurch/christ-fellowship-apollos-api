import { Feature as coreFeatures, Utils } from '@apollosproject/data-connector-rock';
import { get, split, flattenDeep, take, isEmpty } from 'lodash';
import moment from 'moment-timezone';
import ApollosConfig from '@apollosproject/config';

const { ROCK_MAPPINGS, FEATURE_FLAGS, ROCK } = ApollosConfig;
const { createImageUrlFromGuid } = Utils;

export default class Feature extends coreFeatures.dataSource {
  expanded = true;

  /** Create Features */
  createActionBarFeature({ actions }) {
    return {
      // The Feature ID is based on all of the action ids, added together.
      // This is naive, and could be improved.
      id: this.createFeatureId({
        args: {
          actions,
        },
      }),
      actions: actions.map((action) => {
        // Ensures that we have a generated ID for the Primary Action related node, if not provided.
        if (action && action.relatedNode && !action.relatedNode.id) {
          action.relatedNode.id = this.createFeatureId({ args: action.relatedNode });
        }

        return action;
      }),
      // Typename is required so GQL knows specifically what Feature is being created
      __typename: 'ActionBarFeature',
    };
  }

  async createAvatarListFeature({ algorithms, primaryAction, isCard }) {
    const { ActionAlgorithm } = this.context.dataSources;
    const people = ActionAlgorithm.runAlgorithms({ algorithms });

    // Ensures that we have a generated ID for the Primary Action related node, if not provided.
    if (primaryAction && primaryAction.relatedNode && !primaryAction.relatedNode.id) {
      primaryAction.relatedNode.id = this.createFeatureId({
        args: primaryAction.relatedNode,
      });
    }

    return {
      // The Feature ID is based on all of the action ids, added together.
      // This is naive, and could be improved.
      id: this.createFeatureId({
        args: {
          algorithms,
          primaryAction,
          isCard,
        },
      }),
      people,
      isCard,
      primaryAction,
      // Typename is required so GQL knows specifically what Feature is being created
      __typename: 'AvatarListFeature',
    };
  }

  async createHorizontalCardListFeature({
    algorithms = [],
    hyphenatedTitle,
    title,
    subtitle,
    primaryAction,
    cardType,
  }) {
    const { ActionAlgorithm } = this.context.dataSources;
    const cards = ActionAlgorithm.runAlgorithms({ algorithms });

    // Ensures that we have a generated ID for the Primary Action related node, if not provided.
    if (primaryAction && primaryAction.relatedNode && !primaryAction.relatedNode.id) {
      primaryAction.relatedNode.id = this.createFeatureId({
        args: primaryAction.relatedNode,
      });
    }

    return {
      // The Feature ID is based on all of the action ids, added together.
      // This is naive, and could be improved.
      id: this.createFeatureId({
        args: {
          algorithms,
          title,
          subtitle,
          cardType,
        },
      }),
      cards,
      hyphenatedTitle,
      title,
      subtitle,
      primaryAction,
      cardType,
      // Typename is required so GQL knows specifically what Feature is being created
      __typename: 'HorizontalCardListFeature',
    };
  }

  async createLiveStreamListFeature({ algorithms, title, subtitle }) {
    const { ActionAlgorithm } = this.context.dataSources;
    const liveStreams = ActionAlgorithm.runAlgorithms({ algorithms });

    return {
      // The Feature ID is based on all of the action ids, added together.
      // This is naive, and could be improved.
      id: this.createFeatureId({
        args: {
          algorithms,
          title,
          subtitle,
        },
      }),
      title,
      subtitle,
      liveStreams,
      // Typename is required so GQL knows specifically what Feature is being created
      __typename: 'LiveStreamListFeature',
    };
  }

  /** Create Feeds */
  getFeatures = async (featuresConfig = [], args = {}) => {
    return Promise.all(
      featuresConfig.map((featureConfig) => {
        const featureMap = this.FEATURE_MAP || {};
        // Lookup the feature function, based on the name, and run it.
        if (typeof featureMap === 'object') {
          const finalConfig = { ...featureConfig, ...args };

          // ! Deprecation of the 'Hero List Feature' in favor of 'Hero List'
          if (featureConfig.type === 'HeroListFeature') {
            console.warn(
              'Deprecated: Please use the name "HeroList" instead. You used "HeroListFeature"'
            );
            return featureMap['HeroList'](finalConfig);
          }

          const featureMethod = get(
            featureMap,
            finalConfig.type,
            featureMap['ActionList']
          );
          return featureMethod(finalConfig);
        }
      })
    );
  };

  getEventsFeedFeatures() {
    return this.getFeedFeatures(get(ApollosConfig, 'FEATURE_FEEDS.EVENTS_TAB', []));
  }

  async getHomeFeedFeatures(features) {
    const { Flag } = this.context.dataSources;
    const featuresFilteredByPermissions = await Promise.all(
      features.map(async (feature) => {
        const flagKey = get(feature, 'flagKey');

        if (flagKey) {
          const status = await Flag.currentUserCanUseFeature(flagKey);

          if (status !== 'LIVE') return null;
        }

        return feature;
      })
    );

    return Promise.all(
      featuresFilteredByPermissions
        .filter((feature) => !!feature)
        .map((featureConfig) => {
          switch (featureConfig.type) {
            case 'ActionBar':
              return this.createActionBarFeature(featureConfig);
            case 'AvatarList':
              return this.createAvatarListFeature(featureConfig);
            case 'HeroList':
              return this.createHeroListFeature(featureConfig);
            case 'HorizontalCardList':
              return this.createHorizontalCardListFeature(featureConfig);
            case 'PrayerList':
              return this.createPrayerListFeature(featureConfig);
            case 'VerticalCardList':
              return this.createVerticalCardListFeature(featureConfig);
            case 'ActionList':
            default:
              // Action list was the default in 1.3.0 and prior.
              return this.createActionListFeature(featureConfig);
          }
        })
    );
  }

  getGiveFeedFeatures() {
    const { clientVersion } = this.context;
    const versionParse = split(clientVersion, '.').join('');
    const config = get(ApollosConfig, 'FEATURE_FEEDS.GIVE_TAB', []);
    const pushPayConfig = {
      action: 'OPEN_URL',
      title: 'PushPay',
      icon: 'push-pay',
      theme: {
        colors: {
          primary: '#d52158',
        },
      },
      relatedNode: {
        __typename: 'Url',
        url: 'https://cf.church/pushpay?feed=give',
      },
    };
    const payPalConfig = {
      action: 'OPEN_URL',
      title: 'PayPal',
      icon: 'pay-pal',
      theme: {
        colors: {
          primary: '#179bd7',
        },
      },
      relatedNode: {
        __typename: 'Url',
        url: 'http://cf.church/paypal?feed=give',
      },
    };
    const cashAppConfig = {
      action: 'OPEN_URL',
      title: 'CashApp',
      icon: 'cash-app',
      theme: {
        colors: {
          primary: '#1ec27f',
        },
      },
      relatedNode: {
        __typename: 'Url',
        url: 'http://cf.church/cash-app?feed=give',
      },
    };
    const venmoConfig = {
      action: 'OPEN_URL',
      title: 'Venmo',
      icon: 'venmo',
      theme: {
        colors: {
          primary: '#00aeef',
        },
      },
      relatedNode: {
        __typename: 'Url',
        url: 'http://cf.church/venmo?feed=give',
      },
    };

    const actionIndex = config.findIndex((item) => item.type === 'ActionBar');

    if (parseInt(versionParse) >= 540) {
      config[actionIndex].actions = [
        pushPayConfig,
        payPalConfig,
        cashAppConfig,
        venmoConfig,
      ];
    } else {
      pushPayConfig.icon = 'envelope-open-dollar';
      config[actionIndex].actions = [pushPayConfig];
    }

    return this.getFeedFeatures(config);
  }

  async getHomeHeaderFeedFeatures() {
    return Promise.all(
      get(ApollosConfig, 'FEATURE_FEEDS.HOME_HEADER', []).map((featureConfig) => {
        switch (featureConfig.type) {
          case 'PrayerList':
            return this.createPrayerListFeature(featureConfig);
          case 'LiveContentList':
            return this.createLiveStreamListFeature(featureConfig);
          case 'ActionList':
          default:
            return this.createActionListFeature(featureConfig);
        }
      })
    );
  }

  getConnectFeedFeatures() {
    return this.getFeedFeatures(get(ApollosConfig, 'FEATURE_FEEDS.CONNECT_TAB', []));
  }

  async getRockFeedFeatures({ contentChannelId }) {
    if (!contentChannelId) {
      return [];
    }

    const { ContentItem, ContentChannel, Person } = this.context.dataSources;
    const contentItemIds = await ContentChannel.getContentItemIds(contentChannelId);
    /**
     * You may be tempted to replace the following method with ContentItem.getFromIds
     * which wouldn't be wrong, but would also negate the extensive Redis Cache used
     * on each individual Content Item. While not programatically the _best_ way to
     * handle this given the Content Item API, it's actually more performant.
     */
    const contentChannelItems = await Promise.all(
      contentItemIds.map((id) => ContentItem.getFromId(id))
    );

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
  }
}
