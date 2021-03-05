import { RESTDataSource } from 'apollo-datasource-rest';
import ApollosConfig from '@apollosproject/config';
import { get } from 'lodash';

const { FEATURE_FLAGS } = ApollosConfig;

export default class Flag extends RESTDataSource {
  getActiveKeysForCurrentUser = async () => {
    const flags = await this.getAllForCurrentUser();

    return flags.filter(({ status }) => status === 'LIVE').map(({ key }) => key);
  };

  getAllForCurrentUser = async () => {
    const { Auth } = this.context.dataSources;
    const keyStatus = async (key) => {
      /**
       * note : although it might be easier to use a boolean for the status, we want to keep the statuses consistent in case this method is to be used in the future. For that reason, we'll use the string literal for the current flag status and do a string compare in the return
       */
      const flag = get(ApollosConfig, `FEATURE_FLAGS.${key}`, null);
      if (flag && flag.status === 'LIVE') {
        if (flag.securityGroupId) {
          const hasAccess = await Auth.isInSecurityGroup(flag.securityGroupId);
          return {
            key,
            status: hasAccess ? 'LIVE' : 'DISABLED',
          };
        }
      }

      return { key, status: 'DISABLED' };
    };
    const keys = Object.keys(FEATURE_FLAGS);
    const statuses = await Promise.all(keys.map((key) => keyStatus(key)));

    return statuses;
  };

  currentUserCanUseFeature = async (key) => {
    const { Auth } = this.context.dataSources;
    const flag = get(ApollosConfig, `FEATURE_FLAGS.${key}`, null);
    if (flag && flag.status === 'LIVE') {
      if (flag.securityGroupId) {
        return (await Auth.isInSecurityGroup(flag.securityGroupId)) ? 'LIVE' : 'DISABLED';
      }

      return flag.status;
    }

    return 'DISABLED';
  };
}
