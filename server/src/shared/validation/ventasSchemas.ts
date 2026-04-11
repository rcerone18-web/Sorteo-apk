import { z } from 'zod';

export const ventaItemSchema = z.object({
  presentacion: z.string().min(1),
  cantidad: z.number().int().positive(),
});

export const crearVentaSchema = z.object({
  fechaFactura: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cedula: z.string().min(3).max(20),
  nombreCliente: z.string().min(3).max(200),
  valorTotal: z.number().positive(),
  totalHuevos: z.number().int().nonnegative().optional(),
  presentaciones: z.array(ventaItemSchema).min(1),
  codigoBono: z.string().min(3).max(60).optional(),
});

export type CrearVentaDTO = z.infer<typeof crearVentaSchema>;

