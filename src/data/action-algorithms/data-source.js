import {
  ActionAlgorithm as coreActionAlgorithm,
  Utils
} from '@apollosproject/data-connector-rock'
import {
  get,
  flattenDeep,
} from 'lodash'
import moment from 'moment-timezone'
import ApollosConfig from '@apollosproject/config'

const { ROCK_MAPPINGS, ROCK } = ApollosConfig
const { createImageUrlFromGuid } = Utils

export default class ActionAlgorithm extends coreActionAlgorithm {
  expanded = true

  /** Base Attrs and Methods from the Core DataSource */
  baseAlgorithms = this.ACTION_ALGORITHIMS;

  // Names of Action Algoritms mapping to the functions that create the actions.
  ACTION_ALGORITHIMS = Object.entries({
      ...this.baseAlgorithms,
      // We need to make sure `this` refers to the class, not the `ACTION_ALGORITHIMS` object.
      ALL_EVENTS: this.allEventsAlgorithm,
      ALL_LIVE_CONTENT: this.allLiveStreamContentAlgorithm,
      CONTENT_CHANNEL: this.contentChannelAlgorithmWithActionOverride,
      CONTENT_CHILDREN: this.contentChildrenAlgorithm,
      CURRENT_USER: this.currentUserAlgorithm,
      CURRENT_USER_FAMILY: this.currentUserFamilyAlgorithm,
      GLOBAL_CONTENT: this.globalContentAlgorithm,
      MY_GROUPS: this.myGroupsAlgorithm,
      MY_PRAYERS: this.myPrayersAlgorithm,
      MY_VOLUNTEER_GROUPS: this.myVolunteerGroupsAlgorithm,
      PERSONA_FEED: this.personaFeedAlgorithmWithActionOverride,
      ROCK_DYNAMIC_FEED: this.rockDynamicFeed,
      SERMON_CHILDREN: this.sermonChildrenAlgorithm,
      UPCOMING_EVENTS: this.upcomingEventsAlgorithmWithActionOverride,
  }).reduce((accum, [key, value]) => {
      // convenciance code to make sure all methods are bound to the Features dataSource
      // eslint-disable-next-line
      accum[key] = value.bind(this);
      return accum;
  }, {})

  // MARK : - Algorithms
  async allEventsAlgorithm() {
      const { ContentItem } = this.context.dataSources

      const items = await ContentItem.getEvents()

      return items.map((item, i) => ({
          id: `${item.id}${i}`,
          title: item.title,
          relatedNode: { ...item, __type: ContentItem.resolveType(item) },
          image: ContentItem.getCoverImage(item),
          action: 'READ_CONTENT',
          summary: ContentItem.createSummary(item),
      }));
  }

  async allLiveStreamContentAlgorithm() {
      const { LiveStream } = this.context.dataSources;
      const liveStreams = await LiveStream.getLiveStreams();
      return liveStreams;
  }

  async currentUserAlgorithm() {
      const { Auth } = this.context.dataSources

      return Auth.getCurrentPerson()
  }

  async currentUserFamilyAlgorithm() {
      // Get the spouse first and then display the children underneath
      const { Person } = this.context.dataSources
      const family = await Promise.all([
          Person.getSpouseByUser(),
          Person.getChildrenByUser(),
      ])

      return flattenDeep(family).filter(p => !!p)
  }

  async contentChannelAlgorithmWithActionOverride({ action = null, contentChannelId, limit = null } = {}) {
      const contentChannel = await this.contentChannelAlgorithm({ contentChannelId, limit })

      return !!action
          ? contentChannel.map(n => ({ ...n, action }))
          : contentChannel
  }

  async contentChildrenAlgorithm({ contentChannelItemId, limit = 10 }) {
      const { ContentItem } = this.context.dataSources;
      const cursor = (await ContentItem.getCursorByParentContentItemId(
          contentChannelItemId
      )).expand('ContentChannel');
      const items = limit ? await cursor.top(limit).get() : await cursor.get();

      return items.map((item, i) => ({
          id: `${item.id}${i}`,
          title: item.title,
          subtitle: ContentItem.createSummary(item),
          relatedNode: { ...item, __type: ContentItem.resolveType(item) },
          image: ContentItem.getCoverImage(item),
          action: 'READ_CONTENT',
          summary: ContentItem.createSummary(item),
      }));
  }

  async globalContentAlgorithm({ index = 0, limit = null } = {}) {
      const contentChannelId = get(ROCK_MAPPINGS, 'ANNOUNCEMENTS_CHANNEL_ID', null)

      if (contentChannelId == null) {
          throw new Error(
              `A Content Channel Id is a required argument for the GLOBAL_CHANNEL ActionList algorithm.
                  Make sure you have a property inside of ROCK_MAPPINGS called ANNOUNCEMENT_CHANNEL_ID in your config.js`
          )
      }

      const { ContentItem } = this.context.dataSources;
      const cursor = ContentItem.byContentChannelId(contentChannelId).expand(
          'ContentChannel'
      ).skip(index).orderBy('Order')

      const items = limit ? await cursor.top(limit).get() : await cursor.get()

      return items.map((item, i) => ({
          id: `${item.id}${i}`,
          title: item.title,
          subtitle: get(item, 'contentChannel.name'),
          relatedNode: { ...item, __type: ContentItem.resolveType(item) },
          image: ContentItem.getCoverImage(item),
          action: 'READ_GLOBAL_CONTENT',
      }))
  }

  async myGroupsAlgorithm({ limit = null } = {}) {
      const { Group, Auth, ContentItem } = this.context.dataSources

      try {
          // Exclude Dream Team
          const groupTypeKeys = Object.keys(Group.groupTypeMap).filter(key => key !== "DreamTeam")
          const groupTypeIds = groupTypeKeys.map(key => Group.groupTypeMap[key])

          const { id } = await Auth.getCurrentPerson()
          const groups = await Group.getByPerson({ personId: id, groupTypeIds })

          return groups.map((item, i) => {
              const getScheduleFriendlyText = async () => {
                  const schedule = await Group.getScheduleFromId(item.scheduleId)

                  return schedule.friendlyScheduleText
              }

              return ({
                  id: `${item.id}${i}`,
                  title: Group.getTitle(item),
                  relatedNode: {
                      __type: Group.resolveType(item),
                      ...item
                  },
                  image: ContentItem.getCoverImage(item),
                  action: 'READ_GROUP',
                  subtitle: getScheduleFriendlyText()
              })
          });
      } catch (e) {
          console.log("Error getting Groups for current user. User likely not logged in", { e })
      }

      return []
  }

  async myPrayersAlgorithm({ limit = 5 } = {}) {
      const { PrayerRequest, Person } = this.context.dataSources;
      const cursor = await PrayerRequest.byCurrentUser();
      const items = await cursor.top(limit).get();

      return items.map((item, i) => {
          const getProfileImage = async () => {
              const root = await Person.getFromAliasId(item.requestedByPersonAliasId)

              const guid = get(root, 'photo.guid')

              return {
                  sources: [
                      (guid && guid !== ''
                          ? { uri: createImageUrlFromGuid(guid) }
                          : { uri: "https://cloudfront.christfellowship.church/GetImage.ashx?guid=0ad7f78a-1e6b-46ad-a8be-baa0dbaaba8e" })
                  ]
              }
          }

          return ({
              id: `${item.id}${i}`,
              title: item.text,
              relatedNode: {
                  __type: "PrayerRequest",
                  ...item
              },
              image: getProfileImage(),
              action: 'READ_PRAYER',
              subtitle: moment(item.enteredDateTime)
                  .tz(ROCK.TIMEZONE)
                  .utc()
                  .format(),
          })
      });
  }

  async myVolunteerGroupsAlgorithm({ limit = null } = {}) {
      const { Group, Auth } = this.context.dataSources

      try {
          const { id } = await Auth.getCurrentPerson()
          const groups = await Group.getByPerson({
              type: "DreamTeam",
              personId: id,
          })

          return groups.map((item, i) => {
              return ({
                  id: `${item.id}${i}`,
                  title: Group.getTitle(item),
                  relatedNode: {
                      __type: Group.resolveType(item),
                      ...item
                  },
                  image: null,
                  action: 'READ_GROUP',
                  subtitle: ""
              })
          });
      } catch (e) {
          console.log("Error getting Groups for current user. User likely not logged in", { e })
      }

      return []
  }

  async personaFeedAlgorithmWithActionOverride({ action = null } = {}) {
      const personaFeed = await this.personaFeedAlgorithm()

      return !!action
          ? personaFeed.map(n => ({ ...n, action }))
          : personaFeed
  }

  async upcomingEventsAlgorithmWithActionOverride({ action = null, contentChannelId, limit = null } = {}) {
      const events = await this.context.dataSources.ContentItem.getEvents(limit)

      return events.map((event, i) => ({
          id: `${event.id}${i}`,
          title: event.title,
          relatedNode: { ...event, __type: 'EventContentItem' },
          image: event.coverImage,
          action: action || 'READ_EVENT',
      }))
  }
}
