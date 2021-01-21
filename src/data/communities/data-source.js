import { Event as coreEvent } from '@apollosproject/data-connector-rock';
import { flattenDeep } from 'lodash';
import { dataSource as scheduleDataSource } from '../schedule';
import moment from 'moment-timezone';
import ApollosConfig from '@apollosproject/config';

const lineups = [
  {
    title: 'Study Together',
    coverImage: {
      sources: [
        {
          uri: 'https://source.unsplash.com/random/300x200',
        },
      ],
    },
  },
  {
    title: 'Pray Together',
    coverImage: {
      sources: [
        {
          uri: 'https://source.unsplash.com/random/300x230',
        },
      ],
    },
  },
  {
    title: 'Play and Engage',
    coverImage: {
      sources: [
        {
          uri: 'https://source.unsplash.com/random/330x200',
        },
      ],
    },
  },
  {
    title: 'Classes',
    coverImage: {
      sources: [
        {
          uri: 'https://source.unsplash.com/random/320x200',
        },
      ],
    },
  },
]; // Category
export default class Communities {
  getCommunities = () => {
    return [
      {
        id: 321,
        title: 'Crew', // Demographic
        type: 'community',
        summary:
          'A movement of guys of every generation that stand for the Kingdom of God and for each other.',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/300x200',
            },
          ],
        },
        lineups,
      },
      {
        id: 123,
        title: 'Missions',
        type: 'community',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/301x200',
            },
          ],
        },
        lineups,
      },
      {
        id: 4312,
        title: 'Sisterhood',
        type: 'community',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/302x200',
            },
          ],
        },
        lineups,
      },
      {
        id: 1238,
        title: 'Men',
        type: 'community',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/303x200',
            },
          ],
        },
        lineups,
      },
      {
        id: 1230,
        title: 'Students',
        type: 'community',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/304x200',
            },
          ],
        },
        lineups,
      },
      {
        id: 1232347,
        title: 'Marriage',
        type: 'community',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/300x210',
            },
          ],
        },
        lineups,
      },
      {
        id: 12324,
        title: 'Missions',
        type: 'community',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/300x205',
            },
          ],
        },
        lineups,
      },
    ];
  };
}
