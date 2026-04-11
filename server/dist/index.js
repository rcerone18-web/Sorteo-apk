"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = require("./interfaces/http/routes");
const errorMiddleware_1 = require("./interfaces/http/middlewares/errorMiddleware");
const logger_1 = require("./shared/logging/logger");
const mysqlClient_1 = require("./infrastructure/database/mysqlClient");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
app.use(routes_1.apiRoutes);
app.use(errorMiddleware_1.errorMiddleware);
const PORT = Number(process.env.PORT || 3000);
async function main() {
    // Test conexión rápida
    await mysqlClient_1.pool.query('SELECT 1');
    app.listen(PORT, '0.0.0.0', () => {
        logger_1.logger.info({ port: PORT }, 'API Sorteo Promocional (Clean) iniciada');
    });
}
main().catch((err) => {
    logger_1.logger.error({ err }, 'Fallo al iniciar servidor');
    process.exit(1);
});
