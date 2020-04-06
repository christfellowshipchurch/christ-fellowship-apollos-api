import { gql } from 'apollo-server'

import { createApolloServerConfig } from '@apollosproject/server-core'

import * as Analytics from '@apollosproject/data-connector-analytics'
import * as Scripture from '@apollosproject/data-connector-bible'
import * as LiveStream from '@apollosproject/data-connector-church-online'
import * as Cloudinary from '@apollosproject/data-connector-cloudinary'
import * as OneSignal from '@apollosproject/data-connector-onesignal'
import * as Pass from '@apollosproject/data-connector-passes'
import * as Cache from '@apollosproject/data-connector-redis-cache';
import * as Sms from '@apollosproject/data-connector-twilio'
import {
  Followings,
  Interactions,
  RockConstants,
  // Person,
  // ContentItem,
  // ContentChannel,
  Sharable,
  Auth,
  PersonalDevice,
  Template,
  AuthSms,
  // Campus,
  BinaryFiles,
  // Features,
  // Event,
} from '@apollosproject/data-connector-rock'
import * as Theme from './theme'

// This module is used to attach Rock User updating to the OneSignal module.
// This module includes a Resolver that overides a resolver defined in `OneSignal`
import * as OneSignalWithRock from './oneSignalWithRock'

import * as ContentChannel from './content-channel'
import * as ContentItem from './content-item'
import * as Browse from './browse'

// Localized Modules
import * as WebsitePagesContentItem from './website-pages-content-item'
import * as WebsiteContentItem from './website-content-item'
import * as WebsiteHtmlContentItem from './website-html-content-item'
import * as WebsiteGroupContentItem from './website-group-content-item'
import * as WebsiteNavigation from './website-navigation'
import * as WebsiteFeature from './website-feature'

import * as DefinedValue from './defined-value'
import * as DefinedValueList from './defined-value-list'

import * as TwilioNotify from './twilio-notify'
import * as Campus from './campus'
import * as Person from './people'
import * as PhoneNumber from './phone-number'
import * as Address from './address'
import * as Workflow from './workflow'
import * as Schedule from './schedule'
import * as Features from './features'
import * as Event from './events'

import * as Metadata from './metadata'
import * as AdditionalEndpoint from './additional-endpoints'

const data = {
  Followings,
  ContentChannel,
  ContentItem,
  Person,
  // Cloudinary,
  Auth,
  AuthSms,
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
  Event,

  // Local Types
  DefinedValue,
  DefinedValueList,
  PhoneNumber,
  Address,
  Workflow,
  Schedule,

  // Local Content Items
  WebsiteNavigation,
  WebsitePagesContentItem: {
    dataSource: WebsitePagesContentItem.dataSource
  },
  WebsiteContentItem: {
    dataSource: WebsiteContentItem.dataSource
  },
  WebsiteHtmlContentItem: {
    dataSource: WebsiteHtmlContentItem.dataSource
  },
  WebsiteGroupContentItem: {
    dataSource: WebsiteGroupContentItem.dataSource
  },
  WebsiteFeature: {
    dataSource: WebsiteFeature.dataSource
  },

  Browse,
  Cache,

  AdditionalEndpoint,
  Metadata
}

const {
  dataSources,
  resolvers,
  schema,
  context,
  applyServerMiddleware,
  setupJobs,
} = createApolloServerConfig(data)

export {
  dataSources,
  resolvers,
  schema,
  context,
  applyServerMiddleware,
  setupJobs,
}

// the upload Scalar is added
export const testSchema = [
  gql`
    scalar Upload
  `,
  ...schema,
]
