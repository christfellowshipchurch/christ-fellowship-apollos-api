import { RESTDataSource } from 'apollo-datasource-rest';
import RockApolloDataSource from '@apollosproject/rock-apollo-data-source'
import ApollosConfig from '@apollosproject/config'
import { parseGlobalId } from '@apollosproject/server-core'
import { flatten } from 'lodash'
import moment from 'moment-timezone'
import { getIdentifierType } from '../utils'

const { ROCK, ROCK_CONSTANTS, ROCK_MAPPINGS } = ApollosConfig;

export default class Checkinable extends RockApolloDataSource {

    // In order to trigger a Rock Webhook, we need to just hit the base
    // rock url without the `/api` appended. For this, we are going to 
    // set the baseUrl to just that. For any other API requests that need
    // to happen in this datasource, just remember to prefix your request with `/api`
    get baseURL() {
        return process.env.ROCK_API;
    }

    async getFromId(id) {
        const { GroupItem } = this.context.dataSources
        return GroupItem.getFromId(id)
    }

    /** (group, args) */
    getOptions(
        { id, groupTypeId },
        { personId, forDate }
    ) {
        try {
            switch (groupTypeId) {
                case 37: // Dream Team
                default:
                    return this.getVolunteerGroupOptions({ id, personId, forDate })
            }
        } catch (e) {
            console.log({ e })
        }

        return []
    }

    async personIsCheckedIn({
        groupId,
        scheduleId,
        personId,
        forDate
    }) {
        /** Get the Person Alias Id's for the given person */
        const aliasIds = await this.request('/PersonAlias')
            .filter(`PersonId eq ${personId}`)
            .transform(results => results.map(({ id }) => id))
            .get()

        if (aliasIds.length) {
            /** Get the Attendance Occurrences for the given Group and Schedule
                     * 
                     *  Attendance Occurrences are the exact instance that a Check In
                     *  is available for. This is what groups all attendances into commonalities
                     * 
                     *  For example: Group 2 on Sept 1 @ 1pm, Group 2 on Sept 1 @ 3pm, Group 2 on Sept 7 @ 1pm, etc
                     */
            const date = forDate || moment().tz(ROCK.TIMEZONE).format('YYYY-MM-DDT00:00:00')
            const attendanceOccurrences = await this.request('AttendanceOccurrences')
                .filter(`GroupId eq ${groupId}`)
                .andFilter(`ScheduleId eq ${scheduleId}`)
                .andFilter(`(OccurrenceDate gt datetime'${date}' or OccurrenceDate eq datetime'${date}')`)
                .sort([{ field: 'OccurrenceDate', direction: 'desc' }])
                .get()


            if (attendanceOccurrences.length) {
                /** Get the actual attendance record
                 *  Take into account all of the person's Alias Id's so that we don't
                 *  miss any Attendance Record
                 */
                const attendances = flatten(await Promise.all(
                    attendanceOccurrences.map(({ id: oid }) => this.request('Attendances')
                        .filterOneOf(aliasIds.map(aid => `PersonAliasId eq ${aid}`))
                        .andFilter(`OccurrenceId eq ${oid}`)
                        .andFilter(`DidAttend eq true`)
                        .get()
                    )
                ))

                /** Successfully found >= 1 attendance record for the given 
                 *  person id, group id, and schedule id within the minimum
                 *  date
                 */
                if (attendances.length) {
                    return true
                }
            }

        }

        return false
    }

    async getVolunteerGroupOptions({
        id,
        personId = null,
        forDate = null
    }) {
        let options = []
        /**
         * Volunteer Groups use Group Locations to store the schedules, 
         * so this will be our starting point for getting the schedules
         */
        const locations = await this.request('/GroupLocations')
            .filter(`GroupId eq ${id}`)
            .andFilter(`LocationId eq ${ROCK_MAPPINGS.LOCATION_IDS.WEB_AND_APP}`)
            .expand('Schedules')
            .get()

        /** Loop through all locations */
        await Promise.all(locations.map(async l => {
            const { schedules } = l

            /** Loop through all schedules and parse them for the next Start time */
            await Promise.all(schedules.map(async s => {
                const { id: sid } = s
                const lava = `{% schedule id:'${sid}' %}
                    {
                        "nextStartDateTime": "{{ schedule.NextStartDateTime | Date:'yyyy-MM-dd HH:mm' }}",
                        "startOffsetMinutes": {{ schedule.CheckInStartOffsetMinutes }},
                        "endOffsetMinutes": {{ schedule.CheckInEndOffsetMinutes }}
                    }
                {% endschedule %}`
                const response = await this.post(`/Lava/RenderTemplate`, lava.replace(/\n/g, ""))
                const jsonResponse = JSON.parse(response)

                /** Check to make sure the nextStartDateTime is valid */
                if (jsonResponse.nextStartDateTime &&
                    moment(jsonResponse.nextStartDateTime).isValid()) {
                    /** Beginning of the most recent instance */
                    const instanceStartDate = moment
                        .tz(jsonResponse.nextStartDateTime, ROCK.TIMEZONE)
                        .utc()
                    /** Allowed start time for the check in */
                    const checkInStart = moment(instanceStartDate.format()).subtract(jsonResponse.startOffsetMinutes, 'minutes')
                    /** Allowed end time for the check in */
                    const checkInEnd = moment(instanceStartDate.format()).add(jsonResponse.endOffsetMinutes, 'minutes')

                    /** We want to only allow a schedule to be added if the current time falls
                     *  between the start and end date/time of the schedule
                     * 
                     *  For example: a schedule may start at 7am with 30 minutes before and after
                     *  for check in. This would mean that this schedule is valid between 6:30am
                     *  and 7:30am
                     */
                    if (moment().isBetween(checkInStart, checkInEnd)) {
                        options.push({
                            /** Person Id is required
                             *  If the Start Date is right now or in the past, let's check for 
                             *  a check in record. If it's in the future, there's no way for
                             *  someone to have already checked in, so we can just assume false
                             *  and save us a few API calls
                             */
                            id: sid,
                            isCheckedIn: this.personIsCheckedIn({ groupId: id, scheduleId: sid, personId, forDate }),
                            startDateTime: instanceStartDate.format()
                        })
                    }
                }
            }))
        }))

        return options.sort(({ startDateTime: a }, { startDateTime: b }) => moment(a).diff(b))
    }

    mostRecentCheckIn = async (rockPersonId, rockGroupId) => {
        if (rockPersonId && rockGroupId) {
            try {
                const base = "https://rock.christfellowship.church"
                const mostRecent = await this.get(`${base}/Webhooks/Lava.ashx/checkin/latest?personId=${rockPersonId}&groupId=${rockGroupId}`)

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

    checkInCurrentUser = async (id, { scheduleIds = [] }) => {
        const { Workflow, Auth } = this.context.dataSources
        const currentUser = await Auth.getCurrentPerson()

        try {
            if (scheduleIds.length) {
                await Promise.all(scheduleIds.map(sid => Workflow.trigger({
                    id: ROCK_MAPPINGS.WORKFLOW_IDS.CHECK_IN,
                    attributes: {
                        personId: currentUser.id,
                        groupId: id,
                        scheduleId: sid
                    }
                })))
            } else {
                await Workflow.trigger({
                    id: ROCK_MAPPINGS.WORKFLOW_IDS.CHECK_IN,
                    attributes: {
                        personId: currentUser.id,
                        groupId: id
                    }
                })
            }
        } catch (e) {
            console.log(e)
        }

        return { id }
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
                    time: moment().utc().toISOString()
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
