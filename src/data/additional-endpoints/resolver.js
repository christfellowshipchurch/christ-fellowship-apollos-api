import { get } from 'lodash'
import { parseRockKeyValuePairs } from '../utils'

//commment

const moreLinkJson = [
  {
    "name": "Get Involved",
    "links": [
      {
        "name": "Community",
        "icon": "users",
        "uri": "https://beta.christfellowship.church/community-finder",
        "openInApp": true
      },
      {
        "name": "Serve",
        "icon": "handshake",
        "uri": "https://rock.gocf.org/dreamteam",
        "openInApp": true
      },
      {
        "name": "Give",
        "icon": "envelope-open-dollar",
        "uri": "https://pushpay.com/g/christfellowship",
        "openInApp": false
      }
    ]
  },
  {
    "name": "Our Church",
    "links": [
      {
        "name": "About Christ Fellowship",
        "icon": "",
        "uri": "https://beta.christfellowship.church/about",
        "openInApp": true
      },
      {
        "name": "Church Locations",
        "icon": "",
        "uri": "https://beta.christfellowship.church/locations",
        "openInApp": true
      },
      {
        "name": "Contact Us",
        "icon": "",
        "uri": "https://gochristfellowship.com/new-here/contact-us",
        "openInApp": true
      }
    ]
  }
]

const resolver = {
  Query: {
    privacyPolicyUrl: () => "https://beta.christfellowship.church/privacy-policy",
    moreLinks: () => moreLinkJson,
    websiteBanner: async (root, args, { dataSources }) => {
      const contentChannel = await dataSources.WebsiteNavigation.getFromId(54) // Digital Platform Website Pages
      const attributeValue = get(contentChannel, 'attributeValues.websiteBanner.value')
      const callsToAction = parseRockKeyValuePairs(
        attributeValue,
        'call', 'action'
      )

      return get(callsToAction, "[0]", null)
    }
  },
}

export default resolver
