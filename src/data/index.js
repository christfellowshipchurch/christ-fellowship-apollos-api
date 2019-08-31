import { gql } from 'apollo-server';

import { createApolloServerConfig } from '@apollosproject/server-core';

import * as Analytics from '@apollosproject/data-connector-analytics';
import * as Scripture from '@apollosproject/data-connector-bible';
import * as LiveStream from '@apollosproject/data-connector-church-online';
import * as Cloudinary from '@apollosproject/data-connector-cloudinary';
import * as OneSignal from '@apollosproject/data-connector-onesignal';
import * as Pass from '@apollosproject/data-connector-passes';
import * as Sms from '@apollosproject/data-connector-twilio';
import {
  Followings,
  Interactions,
  RockConstants,
  // Person,
  // ContentItem,
  ContentChannel,
  Sharable,
  // Auth,
  PersonalDevice,
  Template,
  // AuthSms,
  // Campus,
  BinaryFiles,
  Features,
} from '@apollosproject/data-connector-rock';
import * as Theme from './theme';

// This module is used to attach Rock User updating to the OneSignal module.
// This module includes a Resolver that overides a resolver defined in `OneSignal`
import * as OneSignalWithRock from './oneSignalWithRock';

import * as ContentItem from './content-item'

// Localized Modules
import * as WebsitePagesContentItem from './website-pages-content-item'
import * as WebsiteContentItem from './website-content-item'
import * as WebsiteGroupContentItem from './website-group-content-item'
import * as WebsiteNavigation from './website-navigation'

import * as DefinedValue from './defined-value'
import * as DefinedValueList from './defined-value-list'

import * as TwilioNotify from './twilio-notify'
import * as Auth from './auth'
import * as Campus from './campus'
import * as Person from './people'
import * as PhoneNumber from './phone-number'
import * as Address from './address'

const data = {
  Followings,
  ContentChannel,
  ContentItem,
  Person,
  // Cloudinary,
  Auth,
  AuthSms: Auth,
  Sms: TwilioNotify,
  LiveStream,
  Theme,
  Scripture,
  Interactions,
  RockConstants,
  Sharable,
  Analytics,
  OneSignal,
  PersonalDevice,
  OneSignalWithRock,
  Pass,
  Template,
  Campus,
  BinaryFiles,
  Features,
  TwilioNotify,

  // Local Types
  DefinedValue,
  DefinedValueList,
  PhoneNumber,
  Address,

  // Local Content Items
  WebsitePagesContentItem,
  WebsiteContentItem,
  WebsiteGroupContentItem,
  WebsiteNavigation
};

const {
  dataSources,
  resolvers,
  schema,
  context,
  applyServerMiddleware,
} = createApolloServerConfig(data);

export { dataSources, resolvers, schema, context, applyServerMiddleware };

// the upload Scalar is added
export const testSchema = [
  gql`
    scalar Upload
  `,
  ...schema,
];
