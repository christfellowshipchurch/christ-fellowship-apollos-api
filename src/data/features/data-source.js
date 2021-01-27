import { Feature as coreFeatures } from '@apollosproject/data-connector-rock';
import { get } from 'lodash';

export default class Feature extends coreFeatures.dataSource {
  expanded = true;

  FEATURE_MAP = Object.entries({
    // We need to make sure `this` refers to the class, not the `FEATURE_MAP` object.
    ActionBar: this.createActionBarFeature,
    ActionList: this.createActionListFeature,
    AvatarList: this.createAvatarListFeature,
    HeroList: this.createHeroListFeature,
    HorizontalCardList: this.createHorizontalCardListFeature,
    PrayerList: this.createPrayerListFeature,
    LiveContentList: this.createLiveStreamListFeature,
    VerticalCardList: this.createVerticalCardListFeature,
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
}
