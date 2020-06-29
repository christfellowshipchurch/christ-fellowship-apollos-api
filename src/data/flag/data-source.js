import { RESTDataSource } from 'apollo-datasource-rest';
import ApollosConfig from '@apollosproject/config'
import { get } from 'lodash'

export default class Flag extends RESTDataSource {

    currentUserCanUseFeature = async (key) => {
        const { Auth } = this.context.dataSources;
        const flag = get(ApollosConfig, `FEATURE_FLAGS.${key}`, null)
        if (flag && flag.status === "LIVE") {
            if (flag.securityGroupId) {
                return await Auth.isInSecurityGroup(flag.securityGroupId)
                    ? "LIVE"
                    : "DISABLED"
            }

            return flag.status
        }

        return "DISABLED"
    }

}