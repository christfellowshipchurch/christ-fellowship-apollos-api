import { get } from 'lodash';

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
