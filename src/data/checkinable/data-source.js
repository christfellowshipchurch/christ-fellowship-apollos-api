import { RESTDataSource } from 'apollo-datasource-rest';
import ApollosConfig from '@apollosproject/config'
import { parseGlobalId } from '@apollosproject/server-core'
import { first } from 'lodash'
import moment from 'moment-timezone'
import { getIdentifierType } from '../utils'

const { ROCK_CONSTANTS, ROCK_MAPPINGS } = ApollosConfig;

import { currentUserCanUseFeature } from '../flag'

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
            const mostRecent = await this.get(`/Webhooks/Lava.ashx/checkin/latest?personId=${rockPersonId}&groupId=${rockGroupId}`)

            if (mostRecent && mostRecent.DidAttend) {
                const m = moment.tz(mostRecent.CheckedInDate, ApollosConfig.ROCK.TIMEZONE)
                // something is happening right now where moment tz is not properly
                // parsing the times of schedules. Every time that is recorded in Rock
                // is set to 4 hours ahead of it's real time in order to counter this.
                // We need to do the same for the incoming CheckInDate, or else we will
                // never have check in available for anyone.
                const offset = 60 * 4

                return m.clone().utcOffset(offset).utc().format()
            }
        }

        return null
    }

    mostRecentCheckInForCurrentPerson = async (rockGroupId) => {
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

    getByContentItem = async (id) => {
        try {
            const featureStatus = await currentUserCanUseFeature("CHECK_IN")

            if (featureStatus !== "LIVE") return null
        } catch (e) {
            return null
        }

        const { ContentItem } = this.context.dataSources;
        // Get the content item from the ID passed in
        const contentItem = await ContentItem.getFromId(id);

        // Find an attribute that contains the word 'group' and 
        // is also a group type in Rock
        const { attributes, attributeValues } = contentItem;
        const groupKey = Object.keys(attributes).find(key =>
            key.toLowerCase().includes('group')
            && attributes[key].fieldTypeId === ROCK_CONSTANTS.GROUP)

        if (groupKey && groupKey !== '') {
            // The workflow in Rock requires an integer id, so if
            // the attribute value we get is a guid, we need to get
            // the id from Rock and cache the value in Redis for later
            // access.
            const groupValue = attributeValues[groupKey].value
            if (groupValue && groupValue !== '') {
                const identifier = getIdentifierType(groupValue)
                switch (identifier.type) {
                    case 'int':

                        const mostRecentOccurrenc = await this.mostRecentCheckIn(207268, identifier.value)
                        return {
                            id: identifier.value,
                            isCheckedIn: false
                        }
                    case 'guid':
                        const { id } = await this.context.dataSources.Group.getFromId(identifier.value)
                        const mostRecentOccurrence = await this.mostRecentCheckIn(207268, id)

                        return {
                            id,
                            isCheckedIn: false
                        }

                    default:
                        break;
                }
            }
        }

        return null
    }
}
