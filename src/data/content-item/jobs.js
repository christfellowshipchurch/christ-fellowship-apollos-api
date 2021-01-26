import ApollosConfig from '@apollosproject/config';
import { isEmpty } from 'lodash';
import moment from 'moment-timezone';
import Redis from 'ioredis';

const { ROCK } = ApollosConfig;
const { REDIS_URL } = process.env;

const deleteJobs = () => {
  const redis = new Redis(REDIS_URL);
  const deleteKeysByPattern = (pattern) => {
    return new Promise((resolve, reject) => {
      const stream = redis.scanStream({
        match: pattern
      });
      stream.on("data", (keys) => {
        if (keys.length) {
          const pipeline = redis.pipeline();
          keys.forEach((key) => {
            pipeline.del(key);
            console.log(`Deleted algolia redis job key: ${key}`)
          });
          pipeline.exec();
        }
      });
      stream.on("end", () => {
        resolve();
      });
      stream.on("error", (e) => {
        reject(e);
      });
    });
  };
  // "bull" is queue prefix (default), "example" is the name of queue
  deleteKeysByPattern("bull:algolia-full-index-queue:*");
  deleteKeysByPattern("bull:algolia-delta-index-queue:*");
}

// Uncomment to delete algolia keys
// deleteJobs();

const createJobs = ({ getContext, queues }) => {
  // disabling jobs entirely
  deleteJobs()
  return

  const FullIndexQueue = queues.add('algolia-full-index-queue', redisQueueOptions);
  const DeltaIndexQueue = queues.add('algolia-delta-index-queue', redisQueueOptions);

  FullIndexQueue.process(async () => {
    const context = getContext();
    return context.dataSources.ContentItem.indexAll();
  });

  DeltaIndexQueue.process(async () => {
    const context = getContext();
    const jobs = await DeltaIndexQueue.getCompleted();
    const timestamp = isEmpty(jobs)
      ? moment()
        .subtract(1, 'day')
        .toDate()
      : jobs
        .map((j) => j.opts.timestamp)
        .sort((a, b) => {
          if (a > b) {
            return -1;
          }
          if (a < b) {
            return 1;
          }
          return 0;
        })[0];
    const datetime = moment(timestamp)
      .tz(ROCK.TIMEZONE)
      .format()
      .split(/[-+]\d+:\d+/)[0];
    return context.dataSources.ContentItem.deltaIndex({ datetime });
  });

  FullIndexQueue.add(null, { repeat: { cron: '15 3 * * 1' } });
  DeltaIndexQueue.add(null, { repeat: { cron: '15 3 * * *' } });
  // Uncomment this to trigger an index right now.
  // FullIndexQueue.add(null);
  // DeltaIndexQueue.add(null);
};

export default createJobs;