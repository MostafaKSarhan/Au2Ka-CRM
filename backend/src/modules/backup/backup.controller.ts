import { FastifyRequest, FastifyReply } from 'fastify';
import { spawn } from 'child_process';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';

interface DbConnection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/**
 * Reads the connection details out of DATABASE_URL.
 * Expected shape: mysql://user:password@host:port/database
 */
function readConnection(): DbConnection {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new AppError('إعدادات قاعدة البيانات غير مضبوطة على الخادم', 500);

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError('صيغة DATABASE_URL غير صحيحة', 500);
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) throw new AppError('اسم قاعدة البيانات غير موجود في DATABASE_URL', 500);

  return {
    host: url.hostname || '127.0.0.1',
    port: url.port || '3306',
    user: decodeURIComponent(url.username) || 'root',
    password: decodeURIComponent(url.password),
    database,
  };
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    '-',
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
}

export class BackupController {
  /** Summary of what a backup would contain, for the settings screen. */
  static async info(request: FastifyRequest, reply: FastifyReply) {
    const conn = readConnection();

    const [users, customers, vehicles, jobCards, branches, parts, vehicleModels] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.vehicle.count({ where: { deletedAt: null } }),
      prisma.jobCard.count({ where: { deletedAt: null } }),
      prisma.branch.count({ where: { deletedAt: null } }),
      prisma.part.count({ where: { deletedAt: null } }),
      prisma.vehicleModel.count({ where: { deletedAt: null } }),
    ]);

    return reply.send({
      database: conn.database,
      host: conn.host,
      counts: { users, customers, vehicles, jobCards, branches, parts, vehicleModels },
      generatedAt: new Date(),
    });
  }

  /** Streams a full mysqldump of the database as a downloadable .sql file. */
  static async download(request: FastifyRequest, reply: FastifyReply) {
    const conn = readConnection();
    const binary = process.env.MYSQLDUMP_PATH || 'mysqldump';
    const fileName = `au2ka-backup-${conn.database}-${timestamp()}.sql`;

    const args = [
      `--host=${conn.host}`,
      `--port=${conn.port}`,
      `--user=${conn.user}`,
      '--single-transaction',
      '--routines',
      '--events',
      '--default-character-set=utf8mb4',
      '--add-drop-table',
      conn.database,
    ];

    // The password goes through the environment, never the argument list,
    // so it does not show up in the server's process table.
    const child = spawn(binary, args, {
      env: { ...process.env, MYSQL_PWD: conn.password },
      windowsHide: true,
    });

    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      request.log.error({ err }, 'mysqldump failed to start');
      if (!reply.sent) {
        const message =
          err.code === 'ENOENT'
            ? 'أداة mysqldump غير موجودة على الخادم — اضبط المتغير MYSQLDUMP_PATH على مسارها'
            : 'تعذّر تشغيل أداة النسخ الاحتياطي';
        reply.status(500).send({ status: 'error', message });
      }
    });

    child.on('close', code => {
      if (code !== 0) {
        request.log.error({ code, stderr }, 'mysqldump exited with a non-zero code');
      }
    });

    reply
      .header('Content-Type', 'application/sql; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .header('Cache-Control', 'no-store');

    return reply.send(child.stdout);
  }
}
