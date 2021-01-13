import { gql } from 'apollo-server';

import { createApolloServerConfig, Interfaces } from '@apollosproject/server-core';

import * as Analytics from '@apollosproject/data-connector-analytics';
import * as Scripture from '@apollosproject/data-connector-bible';
import * as OneSignal from '@apollosproject/data-connector-onesignal';
import * as Pass from '@apollosproject/data-connector-passes';
import {
  AuthSms,
  BinaryFiles,
  Followings,
  Interactions,
  PersonalDevice,
  Sharable,
  Template,
} from '@apollosproject/data-connector-rock';
import * as Theme from './theme';

// This module is used to attach Rock User updating to the OneSignal module.
// This module includes a Resolver that overides a resolver defined in `OneSignal`
import * as OneSignalWithRock from './oneSignalWithRock';

//
// TODO : use when 1.7.0 goes into production
// import * as ActionAlgorithm from './action-algorithms';
import * as AdditionalEndpoint from './additional-endpoints';
import * as Address from './address';
import * as Auth from './auth';
import * as Browse from './browse';
import * as Cache from './redis-cache';
import * as Campus from './campus';
import * as CheckInable from './checkinable';
import * as ContentChannel from './content-channel';
import * as ContentItem from './content-item';
import * as DefinedValue from './defined-value';
import * as DefinedValueList from './defined-value-list';
import * as Event from './events';
import * as Feature from './features';
import * as Flag from './flag';
import * as Group from './groups';
import * as GroupItem from './group-item';
import * as LiveStream from './live-stream';
import * as MatrixItem from './matrix-item';
import * as Message from './message';
import * as Metadata from './metadata';
import * as PageBuilder from './page-builder';
import * as Person from './people';
import * as PhoneNumber from './phone-number';
import * as PrayerRequest from './prayer-request';
import * as RockConstants from './rock-constants';
import * as Schedule from './schedule';
import * as Search from './search';
import * as SearchGroups from './search-groups';
import * as StreamChat from './stream-chat';
import * as TwilioNotify from './twilio-notify';
import * as Url from './url';
import * as WebsiteContentItem from './website-content-item';
import * as WebsiteFeature from './website-feature';
import * as WebsiteGroupContentItem from './website-group-content-item';
import * as WebsiteHtmlContentItem from './website-html-content-item';
import * as WebsiteNavigation from './website-navigation';
import * as WebsitePagesContentItem from './website-pages-content-item';
import * as Workflow from './workflow';

// MARK : - Please keep in alphabetical order
const data = {
  // ActionAlgorithm,
  AdditionalEndpoint,
  Address,
  Analytics,
  Auth,
  AuthSms,
  BinaryFiles,
  Browse,
  Cache,
  Campus,
  CheckInable,
  ContentChannel,
  ContentItem,
  DefinedValue,
  DefinedValueList,
  Event,
  Feature,
  Flag,
  Followings,
  Group,
  GroupItem,
  Interactions,
  Interfaces,
  LiveStream,
  MatrixItem,
  Message,
  Metadata,
  OneSignal,
  OneSignalWithRock,
  PageBuilder,
  Pass,
  Person,
  PersonalDevice,
  PhoneNumber,
  PrayerRequest,
  RockConstants,
  Schedule,
  Scripture,
  Search,
  SearchGroups,
  Sharable,
  Sms: TwilioNotify,
  StreamChat,
  Template,
  Theme,
  TwilioNotify,
  Url,
  WebsiteContentItem: {
    dataSource: WebsiteContentItem.dataSource,
  },
  WebsiteFeature: {
    dataSource: WebsiteFeature.dataSource,
  },
  WebsiteGroupContentItem: {
    dataSource: WebsiteGroupContentItem.dataSource,
  },
  WebsiteHtmlContentItem: {
    dataSource: WebsiteHtmlContentItem.dataSource,
  },
  WebsiteNavigation,
  WebsitePagesContentItem: {
    dataSource: WebsitePagesContentItem.dataSource,
  },
  Workflow,
};

const {
  dataSources,
  resolvers,
  schema,
  context,
  applyServerMiddleware,
  setupJobs,
} = createApolloServerConfig(data);

export { dataSources, resolvers, schema, context, applyServerMiddleware, setupJobs };

// the upload Scalar is added
export const testSchema = [
  gql`
    scalar Upload
  `,
  ...schema,
];
