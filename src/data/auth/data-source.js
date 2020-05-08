import { Auth as CoreAuth } from '@apollosproject/data-connector-rock';
import { get } from 'lodash';

// const response = await this.post(`/People/AttributeValue/${currentPerson.id}?${attributeKey}&${attributeValue}`)

export default class AuthDataSource extends CoreAuth.dataSource {
    coreCreateUserProfile = this.createUserProfile

    createUserProfile = async (props) => {
        const personId = await this.coreCreateUserProfile(props)

        this.context.dataSources.Person.updateFirstConnection(personId)

        return personId
    };

}