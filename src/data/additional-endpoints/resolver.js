import { get } from 'lodash'
import { parseRockKeyValuePairs } from '../utils'

const moreLinkJson = [
  {
    "name": "Get Involved",
    "links": [
      {
        "name": "Community",
        "icon": "users",
        "uri": "https://christfellowship.church/items/get-stronger-challenge-c3cee8219292873b20ecd2b654500aee",
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
        "uri": "https://christfellowship.church/about",
        "openInApp": true
      },
      {
        "name": "Church Locations",
        "icon": "",
        "uri": "https://christfellowship.church/locations",
        "openInApp": true
      },
      {
        "name": "Contact Us",
        "icon": "",
        "uri": "https://rock.gocf.org/contactus",
        "openInApp": true
      },
      {
        "name": "Online Store",
        "icon": "",
        "uri": "https://resource.gochristfellowship.com/",
        "openInApp": true
      }
    ]
  }
]

const resolver = {
  Query: {
    privacyPolicyUrl: () => "https://christfellowship.church/privacy-policy",
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
