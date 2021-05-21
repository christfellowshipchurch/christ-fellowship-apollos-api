import Redis from 'ioredis';

const { REDIS_URL } = process.env;

let client;
let subscriber;
let queueOpts;

if (REDIS_URL) {
  client = new Redis(REDIS_URL);
  subscriber = new Redis(REDIS_URL);

  // Used to ensure that N+3 redis connections are not created per queue.
  // https://github.com/OptimalBits/bull/blob/develop/PATTERNS.md#reusing-redis-connections
  queueOpts = {
    createClient(type) {
      switch (type) {
        case 'client':
          return client;
        case 'subscriber':
          return subscriber;
        default:
          return new Redis(REDIS_URL);
      }
    },
  };
}

const createJobs = ({ getContext, queues, trigger = () => null }) => {
  const FullIndexQueue = queues.add('algolia-groups-full-index-queue', queueOpts);

  FullIndexQueue.process(async () => {
    const context = getContext();
    return context.dataSources.GroupItem.updateIndexAllGroups();
  });

  FullIndexQueue.add(null, { repeat: { cron: '15 3 * * 1' } });

  // add manual index trigger
  trigger('/manual-index', FullIndexQueue);
};

export default createJobs;
