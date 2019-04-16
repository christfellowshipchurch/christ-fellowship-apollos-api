/* Splits up a Rock Key Value paired string where | splits pairs and ^ splits key and value */
export const parseRockKeyValuePairs = (keyValueStr, keyOverride = null, valueOverride = null) => {
  const key = keyOverride || 'key'
  const value = valueOverride || 'value'

  return keyValueStr.split('|')
    .map((n) => {
      const splt = n.split('^')
      let rtn = {}

      rtn[key] = splt[0] || ''
      rtn[value] = splt[1] || ''

      return rtn
    })
}