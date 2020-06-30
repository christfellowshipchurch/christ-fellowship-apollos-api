import { RESTDataSource } from 'apollo-datasource-rest';
import ApollosConfig from '@apollosproject/config'
import { parseGlobalId } from '@apollosproject/server-core'
import { first } from 'lodash'
import moment from 'moment-timezone'
import { getIdentifierType } from '../utils'

const { ROCK_CONSTANTS, ROCK_MAPPINGS } = ApollosConfig;

export default class Checkinable extends RESTDataSource {

    // In order to trigger a Rock Webhook, we need to just hit the base
    // rock url without the `/api` appended. For this, we are going to 
    // set the baseUrl to just that. For any other API requests that need
    // to happen in this datasource, just remember to prefix your request with `/api`
    get baseURL() {
        return process.env.ROCK_API;
    }

    mostRecentCheckIn = async (rockPersonId, rockGroupId) => {
        if (rockPersonId && rockGroupId) {
            try {
                const mostRecent = await this.get(`/Webhooks/Lava.ashx/checkin/latest?personId=${rockPersonId}&groupId=${rockGroupId}`)

                if (mostRecent && mostRecent.DidAttend) {
                    const m = moment.tz(mostRecent.CheckedInDate, ApollosConfig.ROCK.TIMEZONE)

                    return m.utc().format()
                }
            } catch (e) {
                console.log(e)
            }
        }

        return null
    }

    mostRecentCheckInForCurrentPerson = async (rockGroupId) => {
        console.log({ rockGroupId })
        if (rockGroupId) {
            try {
                const { id } = await this.context.dataSources.Auth.getCurrentPerson()

                return this.mostRecentCheckIn(id, rockGroupId)
            } catch (e) {
                console.log("User is not logged in. Skipping check in check")
            }
        }

        return null
    }

    checkInCurrentUser = async (id) => {
        const { Group, Workflow, Auth } = this.context.dataSources
        const { guid } = await Group.getFromId(id)
        const currentUser = await Auth.getCurrentPerson()

        try {
            const workflowResponse = await Workflow.trigger({
                id: ROCK_MAPPINGS.WORKFLOW_IDS.CHECK_IN,
                attributes: { personId: currentUser.id, group: guid }
            })

            if (workflowResponse.status !== "Failed") {
                return { id }
            }
        } catch (e) {
            console.log(e)
        }

        return null

    }

    isCheckedInBySchedule = async ({ scheduleIds, groupId }) => {
        const { Schedule } = this.context.dataSources;
        const mostRecentCheckIn = await this.mostRecentCheckInForCurrentPerson(groupId)

        if (mostRecentCheckIn) {
            return await Schedule.timeIsInSchedules({
                ids: scheduleIds,
                time: mostRecentCheckIn
            })
        }

        return false
    }

    getByContentItem = async (id) => {
        const { ContentItem, Flag, Group, Schedule } = this.context.dataSources;

        try {
            const featureStatus = await Flag.currentUserCanUseFeature("CHECK_IN")
            if (featureStatus !== "LIVE") return null
        } catch (e) {
            console.log(e)
            return null
        }

        // Get the content item from the ID passed in
        const contentItem = await ContentItem.getFromId(id);

        // Find an attribute that contains the word 'group' and 
        // is also a group type in Rock
        const { attributes, attributeValues } = contentItem;
        const groupKey = Object.keys(attributes).find(key =>
            key.toLowerCase().includes('group')
            && attributes[key].fieldTypeId === ROCK_CONSTANTS.GROUP)
        const scheduleKey = Object.keys(attributes).find(key =>
            key.toLowerCase().includes('schedule')
            && (attributes[key].fieldTypeId === ROCK_CONSTANTS.SCHEDULES
                || attributes[key].fieldTypeId === ROCK_CONSTANTS.SCHEDULE))

        if (groupKey && groupKey !== '') {
            // The workflow in Rock requires an integer id, so if
            // the attribute value we get is a guid, we need to get
            // the id from Rock and cache the value in Redis for later
            // access.
            const groupValue = attributeValues[groupKey].value
            const scheduleIds = attributeValues[scheduleKey].value

            if (groupValue && groupValue !== '') {
                // At this point, we want to check and make sure that we should even
                // be offering check in. We want want to check if `now` falls within
                // a time of the schedules on the content item
                //
                const showSchedule = await Schedule.timeIsInSchedules({
                    ids: scheduleIds.split(','),
                    time: moment().toISOString()
                })

                if (!showSchedule) return null

                const identifier = getIdentifierType(groupValue)

                switch (identifier.type) {
                    case 'int':
                        return {
                            id: identifier.value,
                            isCheckedIn: await this.isCheckedInBySchedule({
                                groupId: identifier.value,
                                scheduleIds: scheduleIds.split(",")
                            })
                        }
                    case 'guid':
                        const { id } = await Group.getFromId(identifier.value)
                        return {
                            id,
                            isCheckedIn: await this.isCheckedInBySchedule({
                                groupId: id,
                                scheduleIds: scheduleIds.split(",")
                            })
                        }
                    default:
                        break;
                }
            }
        }

        return null
    }
}
