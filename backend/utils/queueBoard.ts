import { createBullBoard } from '@bull-board/api';
// @ts-ignore
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
// @ts-ignore
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './queue.js';
import { Express } from 'express';
import { protect, authorizeAdmin } from '../middleware/auth.js';

export const setupQueueBoard = (app: Express) => {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter: serverAdapter,
  });

  // Mount the Bull-Board UI behind the admin authentication middleware
  app.use('/admin/queues', protect, authorizeAdmin, serverAdapter.getRouter());
};
