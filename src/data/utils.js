import ApollosConfig from '@apollosproject/config'

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
export const createVideoUrlFromGuid = (uri) =>
    uri.split('-').length === 5
        ? `${ApollosConfig.ROCK.FILE_URL}?guid=${uri}`
        : Utils.enforceProtocol(uri)