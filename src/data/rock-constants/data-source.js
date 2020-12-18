import { RockConstants as coreRockConstants } from '@apollosproject/data-connector-rock';

export default class RockConstants extends coreRockConstants.dataSource {
  superModelType = this.modelType;
  modelType(nameInput) {
    const { Cache } = this.context.dataSources;
    const request = () => this.superModelType(nameInput);

    return Cache.request(request, {
      key: Cache.KEY_TEMPLATES.rockConstant`${nameInput}`,
      expiresIn: 60 * 60 * 24, // 24 hour cache
    });
  }
}
