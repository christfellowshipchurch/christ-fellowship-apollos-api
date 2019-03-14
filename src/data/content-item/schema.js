import { contentItemSchema } from '@apollosproject/data-schema';
import { gql } from 'apollo-server';

export default gql`
    ${contentItemSchema}
`;