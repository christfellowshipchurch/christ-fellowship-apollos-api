import { Event as coreEvent } from '@apollosproject/data-connector-rock';
import { flattenDeep } from 'lodash';
import { dataSource as scheduleDataSource } from '../schedule';
import moment from 'moment-timezone';
import ApollosConfig from '@apollosproject/config';

export default class Communities {
  getCommunities = () => {
    return [
      {
        id: 321,
        title: 'Crew',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/300x200',
            },
          ],
        },
      },
      {
        id: 123,
        title: 'Missions',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/301x200',
            },
          ],
        },
      },
      {
        id: 4312,
        title: 'Sisterhood',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/302x200',
            },
          ],
        },
      },
      {
        id: 1238,
        title: 'Men',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/303x200',
            },
          ],
        },
      },
      {
        id: 1230,
        title: 'Students',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/304x200',
            },
          ],
        },
      },
      {
        id: 1232347,
        title: 'Marriage',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/300x210',
            },
          ],
        },
      },
      {
        id: 12324,
        title: 'Missions',
        summary: 'Blah Blah Blah',
        coverImage: {
          sources: [
            {
              uri: 'https://source.unsplash.com/random/300x205',
            },
          ],
        },
      },
    ];
  };
}
