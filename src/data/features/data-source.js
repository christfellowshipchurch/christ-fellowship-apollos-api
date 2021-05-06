import { Feature as coreFeatures } from '@apollosproject/data-connector-rock';
import { first, get, isEmpty } from 'lodash';

import sanitizeHtml from '../sanitize-html';
import { parseRockKeyValuePairs } from '../utils';

export default class Feature extends coreFeatures.dataSource {
  expanded = true;

  FEATURE_MAP = Object.entries({
    // We need to make sure `this` refers to the class, not the `FEATURE_MAP` object.
    ActionBar: this.createActionBarFeature,
    ActionList: this.createActionListFeature,
    AvatarList: this.createAvatarListFeature,
    ContentBlock: this.createContentBlockFeature,
    HeroList: this.createHeroListFeature,
    HorizontalCardList: this.createHorizontalCardListFeature,
    PrayerList: this.createPrayerListFeature,
    LiveContentList: this.createLiveStreamListFeature,
    VerticalCardList: this.createVerticalCardListFeatureOverride,
  }).reduce((accum, [key, value]) => {
    // convenciance code to make sure all methods are bound to the Features dataSource
    // eslint-disable-next-line
    accum[key] = value.bind(this);
    return accum;
  }, {});

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

  async createContentBlockFeature({ contentChannelItemId, ...props }) {
    if (!contentChannelItemId) {
      return {
        __typename: 'ContentBlockFeature',
        ...props,
      };
    }

    const { ContentItem, DefinedValue } = this.context.dataSources;

    const contentItem = await ContentItem.getFromId(contentChannelItemId);
    const summary = get(contentItem, 'attributeValues.summary.value', '');
    const contentLayoutDefinedValue = get(
      contentItem,
      'attributeValues.contentLayout.value',
      ''
    );
    const actionsAttributeValue = get(contentItem, 'attributeValues.actions.value', '');
    const actionsKeyValue = parseRockKeyValuePairs(actionsAttributeValue, 'title', 'url');

    let orientation = 'LEFT';

    if (!isEmpty(contentLayoutDefinedValue)) {
      const definedValue = await DefinedValue.getFromId(contentLayoutDefinedValue);

      orientation = definedValue?.value ? definedValue?.value : orientation;
    }

    return {
      // The Feature ID is based on all of the action ids, added together.
      // This is naive, and could be improved.
      id: this.createFeatureId({
        args: {
          contentChannelItemId,
        },
      }),
      title: contentItem.title,
      subtitle: get(contentItem, 'attributeValues.summary.value', ''),
      summary,
      htmlContent: sanitizeHtml(contentItem.content),
      coverImage: ContentItem.getCoverImage(contentItem),
      orientation: orientation.toUpperCase(),
      actions: actionsKeyValue.map(({ title, url }) => ({
        title,
        action: 'OPEN_URL',
        relatedNode: {
          __typename: 'Url',
          url,
        },
      })),
      // Typename is required so GQL knows specifically what Feature is being created
      __typename: 'ContentBlockFeature',
    };
  }

  async createHtmlBlockFeature({ contentChannelItemId }) {
    const { ContentItem, DefinedValue } = this.context.dataSources;

    const contentItem = await ContentItem.getFromId(contentChannelItemId);

    return {
      // The Feature ID is based on all of the action ids, added together.
      // This is naive, and could be improved.
      id: this.createFeatureId({
        args: {
          contentChannelItemId,
        },
      }),
      title: contentItem.title,
      htmlContent: contentItem.content,
      // Typename is required so GQL knows specifically what Feature is being created
      __typename: 'HtmlBlockFeature',
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
    if (primaryAction) {
      // eslint-disable-next-line no-param-reassign
      primaryAction = this.attachRelatedNodeId(primaryAction);
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
          primaryAction,
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

  createVerticalCardListFeatureOverride(props) {
    if (get(props, 'cards', []).length > 0) {
      return {
        __typename: 'VerticalCardListFeature',
        ...props,
      };
    }

    return this.createVerticalCardListFeature(props);
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
}
