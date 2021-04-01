import { get } from 'lodash';

async function handleNewMessage(data, { Person, OneSignal }) {
  const senderName = get(data, 'user.name');
  const memberIds = get(data, 'members', []).map(({ user_id }) => user_id);
  const content = get(data, 'message.text', '');

  console.log({ context });

  const aliasIds = await Promise.all(
    memberIds.map(async (id) => {
      const { id: rockPersonId } = parseGlobalId(`Person:${id}`);
      const person = await Person.getFromId(rockPersonId);
      return get(person, 'primaryAliasId');
    })
  );

  console.log({ aliasIds });

  // OneSignal.createNotification({
  //   toUserIds = aliasIds,
  //   content,
  //   heading: `New Message from ${senderName}`,
  // })
}

export default ({ app, getContext }) => {
  app.post('/stream-chat/webhook', (req, res) => {
    const context = getContext({ req });
    const body = get(req, 'body', {});
    const type = get(body, 'type');

    switch (type) {
      case 'message.new':
        context.dataSources.StreamChat.handleNewMessage(body);
        break;
      default:
        break;
    }

    res.send('ok');
  });
};
