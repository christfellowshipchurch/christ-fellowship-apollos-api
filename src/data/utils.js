import ApollosConfig from '@apollosproject/config'
import {
  createGlobalId,
} from '@apollosproject/server-core'
import { Utils } from '@apollosproject/data-connector-rock'
import { get, last } from 'lodash'

/*
 Splits up a Rock Key Value paired string where | splits pairs and ^ splits key and value
 Returns null if keyValueStr is null */
export const parseRockKeyValuePairs = (keyValueStr, keyOverride = null, valueOverride = null) => {
  const key = keyOverride || 'key'
  const value = valueOverride || 'value'

  return keyValueStr
    ? keyValueStr.split('|')
      .map((n) => {
        const splt = n.split('^')
        let rtn = {}

        rtn[key] = splt[0] || ''
        rtn[value] = splt[1] || ''

        return rtn
      })
    : []
}

/*
  Parses an identifier to find if it's a Guid or Int or Custom identifier
  If Guid or Int, the object will return a suggested REST query for the identifier */
export const getIdentifierType = (identifier) => {
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const intRegex = /\D/g
  const stringId = identifier.toString()

  if (stringId.match(guidRegex)) {
    return { type: 'guid', value: identifier, query: `Guid eq (guid'${identifier}')` }
  } else if (!stringId.match(intRegex)) {
    return { type: 'int', value: identifier, query: `Id eq ${identifier}` }
  }

  return { type: 'custom', value: identifier, query: null }
}

/*
  Accepts a GUID for a video file, then creates the appropriate uri endpoint
  for the video file */
// export const createVideoUrlFromGuid = (uri) => uri
export const createVideoUrlFromGuid = (uri) =>
  uri.startsWith('http')
    ? Utils.enforceProtocol(uri)
    : `${ApollosConfig.ROCK.FILE_URL}?guid=${uri}`

/*
  Accepts a string url that is read and determined if a deep link can be
  generated for it. If it can, an updated url will be created and returned
  back to the client.

  NOTE: it is assumed that the client requesting this update is a mobile app
        so that a deep link url can be created. Web apps should not use this */
const appLinkTag = (strings, id) => `christfellowship://c/ContentSingle?itemId=${strings[0]}${id}`
export const generateAppLinkFromUrl = async (uri, context) => {
  const url = new URL(uri)
  const host = url.host

  if (host === "christfellowship.church") {
    // Remove the first instance of / (/content/title-${itemId}) so that our array
    //  after the split is ['content', 'title-${itemId}']
    const pathParts = url.pathname.replace('/', '').split('/')

    if (pathParts.length > 1) {
      const id = last(pathParts[1].split('-'))
      switch (pathParts[0]) {
        case 'content':
          return appLinkTag`UniversalContentItem:${id}`
        case 'items':
          return appLinkTag`InformationalContentItem:${id}`
        case 'events':
          const { dataSources } = context
          const contentItem = await dataSources.ContentItem.getEventByTitle(pathParts[1])
          const id = get(contentItem, 'id')
          if (id) {
            return appLinkTag`EventContentItem:${createGlobalId(id)}`
          }
      }
    }
  }

  return uri
}