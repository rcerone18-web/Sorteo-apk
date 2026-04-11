import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { apiRoutes } from './interfaces/http/routes';
import { errorMiddleware } from './interfaces/http/middlewares/errorMiddleware';
import { logger } from './shared/logging/logger';
import { pool } from './infrastructure/database/mysqlClient';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(apiRoutes);
app.use(errorMiddleware);

const PORT = Number(process.env.PORT || 3000);

async function main() {
  // Test conexión rápida
  await pool.query('SELECT 1');
  app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT }, 'API Sorteo Promocional (Clean) iniciada');
  });
}

main().catch((err) => {
  logger.error({ err }, 'Fallo al iniciar servidor');
  process.exit(1);
});

