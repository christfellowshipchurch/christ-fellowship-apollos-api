export default {
    Mutation: {
        updateUserPushSettingsTN: (root, { input }, { dataSources }) =>
            dataSources.TwilioNotify.updatePushSettings(input),
        sendPushNotification: async (root, { input }, { dataSources }) => {
            try {
                await dataSources.TwilioNotify.sendPushNotification(input)

                return true
            } catch (e) {
                console.log({ e })

                return false
            }
        },
    },
};
