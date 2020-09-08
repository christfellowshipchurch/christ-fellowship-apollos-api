import ApollosConfig from '@apollosproject/config';
import GroupDataSource from '../data-source';

ApollosConfig.loadJs({
  ROCK_MAPPINGS: {
    SERVING_GROUP_TYPE_ID: 23,
    COMMUNITY_GROUP_TYPE_ID: 25,
    FAMILY_GROUP_TYPE_ID: 10,
    ADULT_GROUP_TYPE_ID: 31,
    FREEDOM_GROUP_TYPE_ID: 92,
  },
});

describe('Group data sources', () => {
  let Group;
  beforeEach(() => {
    Group = new GroupDataSource();
    Group.context = { dataSources: {} };
  });
  it('gets a map of group type IDs', () => {
    expect(Group.getGroupTypeIds()).toMatchSnapshot();
  });
});
