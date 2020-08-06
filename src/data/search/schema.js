import { searchSchema } from '@apollosproject/data-schema';
import gql from 'graphql-tag';

export default gql`
    ${searchSchema}

    enum INDEX_ACTION {
        update
        delete
    }

    extend type Mutation {
        indexContentItem(id: String, action: INDEX_ACTION, key: String): String
    }
`