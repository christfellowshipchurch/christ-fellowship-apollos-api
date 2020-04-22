import { get } from 'lodash'
import { parseRockKeyValuePairs } from '../utils'

const moreLinkJson = [
  // {
  //   "name": "Get Involved",
  //   "links": [
  //     {
  //       "name": "Community",
  //       "icon": "users",
  //       "uri": "https://beta.christfellowship.church/community-finder",
  //       "openInApp": true
  //     },
  //     {
  //       "name": "Serve",
  //       "icon": "handshake",
  //       "uri": "https://rock.gocf.org/dreamteam",
  //       "openInApp": true
  //     },
  //     {
  //       "name": "Give",
  //       "icon": "envelope-open-dollar",
  //       "uri": "https://pushpay.com/g/christfellowship",
  //       "openInApp": false
  //     }
  //   ]
  // },
  {
    "name": "Our Church",
    "links": [
      {
        "name": "Church Locations",
        "icon": "building",
        "uri": "https://beta.christfellowship.church/locations",
        "openInApp": true
      },
      {
        "name": "About",
        "icon": "information",
        "uri": "https://beta.christfellowship.church/about",
        "openInApp": true
      },
      {
        "name": "Contact Us",
        "icon": "text",
        "uri": "https://gochristfellowship.com/new-here/contact-us",
        "openInApp": true
      }
    ]
  },
  {
    name: 'App Info',
    links: [
      {
        name: 'Terms & Conditions',
        icon: 'list',
        uri: 'https://christfellowship.church/terms-of-use',
        openInApp: true,
      },
      {
        name: 'Privacy Policy',
        icon: 'lock',
        uri: 'https://christfellowship.church/privacy-policy',
        openInApp: true,
      },
    ],
  }
]

const profileLinkJson = [
  {
    "name": "Connect",
    "icon": "users",
    "uri": "https://rock.christfellowship.church/connect",
    "openInApp": true
  },
  {
    "name": "Serve",
    "icon": "handshake",
    "uri": "https://rock.christfellowship.church/page/2057",
    "openInApp": true
  },
  {
    "name": "Give",
    "icon": "envelope-open-dollar",
    "uri": "https://pushpay.com/g/christfellowship",
    "openInApp": false
  }
]

const resolver = {
  Query: {
    privacyPolicyUrl: () => "https://beta.christfellowship.church/privacy-policy",
    moreLinks: () => moreLinkJson,
    profileLinks: () => profileLinkJson,
    websiteBanner: async (root, args, { dataSources }) => {
      const contentChannel = await dataSources.WebsiteNavigation.getFromId(54) // Digital Platform Website Pages
      const attributeValue = get(contentChannel, 'attributeValues.websiteBanner.value')
      const callsToAction = parseRockKeyValuePairs(
        attributeValue,
        'call', 'action'
      )

      return get(callsToAction, "[0]", null)
    },
    genderOptions: () => ['Male', 'Female']
  },
}

export default resolver
