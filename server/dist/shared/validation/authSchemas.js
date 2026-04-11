"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    usuario: zod_1.z.string().trim().min(1),
    clave: zod_1.z.string().min(1),
});
