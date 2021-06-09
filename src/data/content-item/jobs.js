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
    settings: {
      stalledInterval: 120000,
    },
  };
}

const deleteJobs = async () => {
  const redis = new Redis(REDIS_URL);

  const deleteKeysByPattern = async (pattern) =>
    new Promise((resolve, reject) => {
      const stream = redis.scanStream({
        match: pattern,
      });
      stream.on('data', (keys) => {
        if (keys.length) {
          const pipeline = redis.pipeline();
          keys.forEach((key) => {
            pipeline.del(key);
            console.log(`Deleted algolia redis job key: ${key}`);
          });
          pipeline.exec();
        }
      });
      stream.on('end', () => {
        resolve();
      });
      stream.on('error', (e) => {
        reject(e);
      });
    });

  // "bull" is queue prefix (default), "example" is the name of queue
  await deleteKeysByPattern('bull:algolia-content-full-index-queue:*');
};

const createJobs = async ({ getContext, queues, trigger = () => null }) => {
  // Uncomment if you need to clear all queues, including past success/failures
  await deleteJobs();

  const FullIndexQueue = queues.add(
    'algolia-content-full-index-queue',
    queueOpts
  );

  FullIndexQueue.process(async () => {
    const context = getContext();
    return context.dataSources.ContentItem.indexAll();
  });

  let schedule;

  switch (process.env.NODE_ENV) {
    // Production => 4:00am Every day
    case 'production':
      schedule = '0 4 * * *';
      break;
    // Staging => 4:00am on Wednesdays
    case 'test':
      schedule = '0 4 * * 3';
      break;
    // Dev => 4:00am Every day
    default:
      schedule = '0 4 * * *';
      // schedule = '0/5 * * * *'; // Every 5 minutes
      break;
  }

  FullIndexQueue.add(null, { repeat: { cron: schedule } });

  // add manual index trigger
  trigger('/manual-index/content', FullIndexQueue);
};

export default createJobs;
