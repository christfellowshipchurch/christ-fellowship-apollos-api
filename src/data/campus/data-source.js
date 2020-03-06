import {
  Campus as coreCampus,
} from '@apollosproject/data-connector-rock'
import { get, upperCase, split } from 'lodash'
import { getIdentifierType } from '../utils'

export default class Campus extends coreCampus.dataSource {
  getForPerson = async ({ personId }) => {
    const family = await this.request(`/Groups/GetFamilies/${personId}`)
      .expand('Campus')
      .expand('Campus/Location')
      .expand('Campus/Location/Image')
      .first()

    /* Ensure we have a valid campus instead of returning an empty object
     * if `family.campus` is empty Rock sends:
     *   `{ campus: { location: {} } }`
     */

    if (family && family.campus && family.campus.location) {
      return family.campus
    }

    // TODO : move the default campus into the Apollos Config

    // MARK : This approach defaults a family with no campus to the Church Online
    //          campus by updating the family record
    try {
      console.log(`Updating family id ${family.id} with default campus id ${9}`)
      const familyPatch = await this.patch(`/Groups/${family.id}`, { CampusId: 9 })

      if (familyPatch) {
        this.getForPerson({ personId })
      }

    } catch (e) {
      console.log('Could not patch family with a new campus', { e })
    }

    // MARK : This approach defaults a family with no campus to display the Church Online
    //          campus, but does not change or update the family record
    console.log(`Failed to patch family ${family.id} with default campus ${9}. `)

    // TODO : recator this, .expand('Location') is not working for some reason on the Campuses endpoint
    let defaultCampus = await this.request(`/Campuses/${9}`).get()
    const location = await this.request(`/Locations/${get(defaultCampus, 'locationId', '')}`).get()

    if (defaultCampus && location) {
      defaultCampus.location = location

      return defaultCampus
    }

    throw new Error(`We were unable to find a default campus in Rock. Please check that there is a campus and location set up for the campud id: ${9}`)
  }

  //Reorders getAll campuses to reflect order displayed in Rock
  getAll = () =>
    this.request()
      .filter('IsActive eq true')
      .orderBy('Order')
      .expand('Location')
      .expand('Location/Image')
      .cache({ ttl: 600 }) // ten minutes
      .get();

  getByName = async (name) => this
    .request()
    .filter(`toupper(Name) eq '${upperCase(name)}'`)
    .expand('Location')
    .expand('Location/Image')
    .cache({ ttl: 600 }) // ten minutes
    .first()

  getSchedule = (id) => this
    .request('Schedules')
    .filter(getIdentifierType(id).query)
    .first()

  getFromId = (id) =>
    this.request()
      .filter(getIdentifierType(id).query)
      .expand('Location')
      .expand('Location/Image')
      .first();

  // Returns an array of campuses from either an Int Id or Guid
  getFromIds = (ids) =>
    this.request()
      .filterOneOf(ids.map(n => getIdentifierType(n).query))
      .get()

  // Returns an array of Schedules for the given campus id
  getServiceSchedulesById = async (id) => {
    // Campus object
    const campus = await this.getFromId(id)
    // String of guids separated by ','
    const scheduleGuids = get(campus, 'attributeValues.weekendServiceSchedules.value', '');

    if (scheduleGuids && scheduleGuids !== '') {
      // Split our string by ',' to get an array of Guid str
      const scheduleGuidsArray = split(scheduleGuids, ',')
      if (scheduleGuidsArray.length) {
        return this.context.dataSources.Schedule.getFromIds(scheduleGuidsArray)
      }
    }

    return []
  }
}
