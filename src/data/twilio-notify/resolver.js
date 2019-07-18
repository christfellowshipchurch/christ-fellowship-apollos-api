export default {
    Mutation: {
        updateUserPushSettingsTN: (root, { input }, { dataSources }) =>
            dataSources.TwilioNotify.updatePushSettings(input),
    },
};
