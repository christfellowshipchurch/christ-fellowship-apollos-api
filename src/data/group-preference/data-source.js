import ApollosConfig from '@apollosproject/config';
import RockApolloDataSource from '@apollosproject/rock-apollo-data-source';

const { ROCK_MAPPINGS } = ApollosConfig;

const CAMPUS_UPDATES_GROUPS = {
  10: 1098441,
  17: 1098646,
  6: 1098647,
  9: 1098648,
  4: 1098649,
  7: 1098650,
  8: 1098651,
  14: 1098652,
  12: 1098653,
  2: 1098654,
  13: 1098655,
  20: 1098656,
  3: 1098657,
  5: 1098658,
  1: 1098659,
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default class GroupPreference extends RockApolloDataSource {
  getFromId = (id) => {
    const { DefinedValue } = this.context.dataSources;

    return DefinedValue.getFromId(id);
  };

  getGroupPreferences = async () => {
    const { DefinedValueList } = this.context.dataSources;
    const { definedValues } = await DefinedValueList.getByIdentifier(
      ROCK_MAPPINGS.DEFINED_TYPES.GROUP_PREFERENCES
    );

    const filteredPreferences = definedValues.filter(
      (definedValue) => definedValue && definedValue.isActive
    );

    return filteredPreferences;
  };

  getGroupSubPreferences = async () => {
    const { DefinedValueList } = this.context.dataSources;
    const { definedValues } = await DefinedValueList.getByIdentifier(
      ROCK_MAPPINGS.DEFINED_TYPES.GROUP_SUB_PREFERENCES
    );

    const filteredSubPreferences = definedValues.filter(
      (definedValue) => definedValue && definedValue.isActive
    );

    return filteredSubPreferences;
  };

  subscribeToUpdates = async ({ preferenceId, campusId }) => {
    const { Auth } = this.context.dataSources;
    const campusGroupId = CAMPUS_UPDATES_GROUPS[campusId];

    if (!campusGroupId) return null;

    try {
      const currentUser = await Auth.getCurrentPerson();

      if (!currentUser.id) return null;

      const groupPreference = await this.getFromId(preferenceId);

      if (groupPreference.guid) {
        let groupMemberId = null;
        const { guid } = groupPreference;
        const groupMemberStatus = 1;
        const preferenceAttributeKey = 'attributeKey=Interest';
        const preferenceAttributeValue = `attributeValue=${guid}`;

        const groupMember = await this.request(`/GroupMembers`)
          .filter(`PersonId eq ${currentUser.id}`)
          .andFilter(`GroupId eq ${campusGroupId}`)
          .first();

        if (groupMember) {
          // note : if the Group Member already exists, we'll go ahead and delete the member and re-add them back

          console.log(
            `[GroupPreferece.subscribeToUpdates] Deleting existing Group Member`
          );
          await this.delete(`GroupMembers/${groupMember.id}`);
        }

        // note : if the Group Member doesn't exist, we'll just add the new Group Member
        const postData = {
          IsSystem: false,
          PersonId: currentUser.id,
          GroupId: campusGroupId,
          GroupMemberStatus: groupMemberStatus,
          GroupRoleId: 359,
        };

        console.log(`[GroupPreferece.subscribeToUpdates] Adding new Group Member`);
        const newGroupMember = await this.post('GroupMembers', postData);
        groupMemberId = newGroupMember.id;

        if (groupMemberId) {
          console.log(
            `[GroupPreferece.subscribeToUpdates] Setting Group Member Interest attribute`
          );
          await this.post(
            `GroupMembers/AttributeValue/${campusGroupId}?${preferenceAttributeKey}&${preferenceAttributeValue}`
          );
        }
      }
    } catch (e) {
      console.log(
        `[GroupPreferece.subscribeToUpdates] could not subscribe user to updates`
      );
      console.log(e);
    }
  };
}
