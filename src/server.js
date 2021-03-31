import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import ApollosConfig from '@apollosproject/config';
import express from 'express';
import { RockLoggingExtension } from '@apollosproject/rock-apollo-data-source';
import { BugsnagPlugin } from '@apollosproject/bugsnag';
import { get } from 'lodash';
import {
  resolvers,
  schema,
  testSchema,
  context,
  dataSources,
  applyServerMiddleware,
  setupJobs,
} from './data';

export { resolvers, schema, testSchema };

const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';

const extensions = isDev ? [() => new RockLoggingExtension()] : [];

const cacheOptions = isDev
  ? {}
  : {
      cacheControl: {
        stripFormattedExtensions: false,
        calculateHttpHeaders: true,
        defaultMaxAge: 600,
      },
    };

const { ENGINE } = ApollosConfig;

const apolloServer = new ApolloServer({
  typeDefs: schema,
  resolvers,
  dataSources,
  context: ({ req, res, ...args }) => ({
    ...context({ req, res, ...args }),
    clientVersion: req.headers['apollographql-client-version'],
  }),
  introspection: true,
  extensions,
  plugins: [new BugsnagPlugin()],
  formatError: (error) => {
    console.error(get(error, 'extensions.exception.stacktrace', []).join('\n'));
    return error;
  },
  playground: {
    settings: {
      'editor.cursorShape': 'line',
    },
  },
  ...cacheOptions,
  engine: {
    apiKey: ENGINE.API_KEY,
    schemaTag: ENGINE.SCHEMA_TAG,
    sendHeaders: {
      all: true,
    },
    sendVariableValues: {
      all: true,
    },
  },
});

const app = express();

// health check
app.get('/health', cors(), (req, res) => {
  res.send('ok');
});

// apollos version
app.get('/version', cors(), (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, '..', 'apollos.json'));
    const { version } = JSON.parse(data);
    res.send(version);
  } catch (e) {
    res.send('unknown');
  }
});

app.post('/stream-chat/webhook', cors(), (req, res) => {
  try {
    console.log('🪝 WEBHOOK TRIGGERED! 🪝');
    console.log('req:', req);

    // TODO Enforce security
    // first argument is the request body as a string, second the signature header
    // const valid = client.verifyWebhook(req.rawBody, req.headers['x-signature']);

    res.send('ok');
  } catch (error) {
    console.error('/stream-chat/webhook Error!', error);
  }
});

applyServerMiddleware({ app, dataSources, context });
setupJobs({ app, dataSources, context });

apolloServer.applyMiddleware({ app });
apolloServer.applyMiddleware({ app, path: '/' });

export default app;
