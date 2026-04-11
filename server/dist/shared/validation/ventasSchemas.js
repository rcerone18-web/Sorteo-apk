"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crearVentaSchema = exports.ventaItemSchema = void 0;
const zod_1 = require("zod");
exports.ventaItemSchema = zod_1.z.object({
    presentacion: zod_1.z.string().min(1),
    cantidad: zod_1.z.number().int().positive(),
});
exports.crearVentaSchema = zod_1.z.object({
    fechaFactura: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cedula: zod_1.z.string().min(3).max(20),
    nombreCliente: zod_1.z.string().min(3).max(200),
    valorTotal: zod_1.z.number().positive(),
    totalHuevos: zod_1.z.number().int().nonnegative().optional(),
    presentaciones: zod_1.z.array(exports.ventaItemSchema).min(1),
    codigoBono: zod_1.z.string().min(3).max(60).optional(),
});
