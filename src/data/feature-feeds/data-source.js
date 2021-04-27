import path from 'path';
import yaml from 'js-yaml';
import { createGlobalId } from '@apollosproject/server-core';
import { FeatureFeed as coreFeatureFeed } from '@apollosproject/data-connector-rock';
import { isRequired, isType } from '../utils';

export default class FeatureFeed extends coreFeatureFeed.dataSource {
  superGetFeed = this.getFeed;

  getFeaturesFromYml = async (
    filePath = isRequired('FeatureFeed.getFeaturesFromYml', 'filePath')
  ) => {
    if (isType(filePath, 'filePath', 'string')) {
      let file;
      const finalPath = path.join(__dirname, '..', `${filePath}.yml`);

      try {
        console.log({ finalPath, dir: path.join(__dirname, '..') });
        fs.readdirSync(path.join(__dirname, '..')).forEach((file) => {
          console.log(file);
        });

        file = fs.readFileSync(finalPath, 'utf8');
      } catch (e) {
        throw new Error(`${finalPath} does not exist`);
      }
      const _yml = yaml.safeLoad(file);

      if (_yml.FEATURES) {
        return _yml.FEATURES;
      }
    }

    return [];
  };

  getFeed = async ({ type = '', args = {} }) => {
    const { ContentChannel, ContentItem, PageBuilder } = this.context.dataSources;

    if (type === 'contentChannel') {
      return {
        __typename: 'FeatureFeed',
        id: createGlobalId(JSON.stringify({ type, args }), 'FeatureFeed'),
        getFeatures: () => ContentChannel.getFeatures(args.contentChannelId),
      };
    }

    if (type === 'contentChannelItem') {
      return {
        __typename: 'FeatureFeed',
        id: createGlobalId(JSON.stringify({ type, args }), 'FeatureFeed'),
        getFeatures: () => ContentItem.getFeatures(args.contentChannelItemId),
      };
    }

    if (type === 'pageBuilder') {
      return {
        __typename: 'FeatureFeed',
        id: createGlobalId(JSON.stringify({ type, args }), 'FeatureFeed'),
        getFeatures: () => PageBuilder.getFeatures(args.pathname),
      };
    }

    // if (type === 'yml') {
    //   return {
    //     __typename: 'FeatureFeed',
    //     id: createGlobalId(JSON.stringify({ type, args }), 'FeatureFeed'),
    //     getFeatures: () => this.getFeaturesFromYml(args.filePath),
    //   };
    // }

    return this.superGetFeed({ type, args });
  };
}
