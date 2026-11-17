import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { processQueue, raiseScheduledAlerts } from './modules/messaging/messaging.service';
import { sendDueReminders } from './modules/appointments/appointments.service';

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// M6 — the queue and the recurring alerts are worked on a timer inside the
// server. Set MESSAGING_INTERVAL_MINUTES=0 to turn the worker off.
const INTERVAL_MINUTES = Number(process.env.MESSAGING_INTERVAL_MINUTES ?? 5);

async function tick() {
  try {
    const queue = await processQueue();
    const alerts = await raiseScheduledAlerts();
    const reminders = await sendDueReminders();

    if (queue.delivered > 0 || alerts.subscriptions > 0 || alerts.documents > 0 || reminders > 0) {
      app.log.info(
        { queue, alerts, reminders },
        'messaging worker: delivered internal messages and raised alerts',
      );
    }
  } catch (err) {
    // A failing tick must never take the server down with it.
    app.log.error({ err }, 'messaging worker tick failed');
  }
}

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Workshop CRM Backend running at http://${HOST}:${PORT}`);

    if (INTERVAL_MINUTES > 0) {
      const worker = setInterval(tick, INTERVAL_MINUTES * 60 * 1000);
      // Do not hold the process open just for the timer.
      worker.unref();
      void tick();
      console.log(`📨 Messaging worker running every ${INTERVAL_MINUTES} minute(s)`);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
