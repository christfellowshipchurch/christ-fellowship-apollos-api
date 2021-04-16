import { get } from 'lodash';
import { format, formatDistance } from 'date-fns';
import { parseRockKeyValuePairs, generateAppLinkFromUrl } from '../utils';

const moreLinkJson = [
  {
    name: 'Our Church',
    links: [
      {
        name: 'Church Locations',
        icon: 'building',
        uri: 'https://christfellowship.church/locations',
        openInApp: true,
      },
      {
        name: 'About',
        icon: 'information',
        uri: 'https://christfellowship.church/about',
        openInApp: true,
      },
      {
        name: 'Shop Online',
        icon: 'arrow-back',
        uri: 'https://cf.church/shop',
        openInApp: false,
      },
    ],
  },
  {
    name: 'Contact',
    links: [
      {
        name: 'Contact Us',
        icon: 'text',
        uri: 'https://rock.gocf.org/contactus',
        openInApp: true,
      },
      {
        name: 'Connect Card',
        icon: 'text',
        uri: 'https://rock.gocf.org/connect',
        openInApp: true,
      },
      {
        name: 'Submit a Prayer Request',
        icon: 'pray',
        uri: 'https://rock.gocf.org/RequestPrayer',
        openInApp: true,
      },
    ],
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
      {
        name: 'Send Feedback',
        icon: 'warning',
        uri: 'https://form.jotform.com/201343828801148',
        openInApp: true,
      },
    ],
  },
];

const profileLinkJson = [
  {
    name: 'Groups',
    icon: 'users',
    uri: 'https://rock.gocf.org/groups',
    openInApp: true,
    theme: {
      colors: {
        primary: '#00aeef',
      },
    },
  },
  {
    name: 'Serve',
    icon: 'handshake',
    uri: 'https://rock.christfellowship.church/dreamteam',
    openInApp: true,
    theme: {
      colors: {
        primary: '#d52158',
      },
    },
  },
  {
    name: 'Give',
    icon: 'envelope-open-dollar',
    uri: 'https://pushpay.com/g/christfellowship',
    openInApp: false,
    theme: {
      colors: {
        primary: '#1ec27f',
      },
    },
  },
];

const resolver = {
  AppLink: {
    theme: ({ theme }) => theme,
  },
  Query: {
    privacyPolicyUrl: () => 'https://christfellowship.church/privacy-policy',
    passwordResetUrl: () => 'https://christfellowship.church/login/forgot',
    moreLinks: () => moreLinkJson,
    profileLinks: () => profileLinkJson,
    websiteBanner: async (root, args, { dataSources }) => {
      const contentChannel = await dataSources.WebsiteNavigation.getFromId(54); // Digital Platform Website Pages
      const attributeValue = get(contentChannel, 'attributeValues.websiteBanner.value');
      const callsToAction = parseRockKeyValuePairs(attributeValue, 'call', 'action');

      return get(callsToAction, '[0]', null);
    },
    genderOptions: () => ['Male', 'Female'],
    inAppLink: (root, { url }, context) => generateAppLinkFromUrl(url, context),
    dannysContent: async (root, args, { dataSources: { ContentItem } }) => {
      const contentItem = await ContentItem.byContentChannelId(73).get();
      return contentItem;
    },
    // ! remove after the Groups launch
    // loadGroupsCache: async (root, args, { dataSources }) => {
    //   const { Group } = dataSources;
    //   const started = new Date();

    //   console.log(`[load groups cache] started ${format(started, 'hh:mm:ss')}`);
    //   await Group.loadGroups();

    //   const end = new Date();
    //   console.log(`[load groups cache] finished ${format(end, 'hh:mm:ss')}`);
    //   console.log(`[load groups cache] duration ${formatDistance(started, end)}`);
    // },
  },
};

export default resolver;
