import { Campus as coreCampus } from '@apollosproject/data-connector-rock'
import { resolverMerge } from '@apollosproject/server-core'
import { get } from 'lodash'

const resolver = {
  Campus: {
    image: ({ attributeValues }) => ({
      uri: get(attributeValues, 'squareImageUrl.value', null)
    })
  }
}

export default resolverMerge(resolver, coreCampus)
