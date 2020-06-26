export { default as resolver } from './resolver';
export { default as schema } from './schema';

export const currentUserCanUseFeature = async (key) => {
    const flag = get(ApollosConfig, `FEATURE_FLAGS.${key}`, null)
    if (flag && flag.status === "LIVE") {
        if (flag.securityGroupId) {
            return await dataSources.Auth.isInSecurityGroup(flag.securityGroupId)
                ? "LIVE"
                : "DISABLED"
        }

        return flag.status
    }

    return "DISABLED"
}