import type { Request, Response, NextFunction } from 'express';
import type { CrearVentaUseCase } from '../../../domain/use-cases/ventas/CrearVentaUseCase';
import type { CrearVentaDTO } from '../../../shared/validation/ventasSchemas';

export class VentasController {
  constructor(private crearVentaUseCase: CrearVentaUseCase) {}

  crearVenta = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CrearVentaDTO;
      const out = await this.crearVentaUseCase.execute({
        fechaFactura: body.fechaFactura,
        cedula: body.cedula,
        nombreCliente: body.nombreCliente,
        valorTotal: body.valorTotal,
        totalHuevos: body.totalHuevos,
        presentaciones: body.presentaciones,
        codigoBono: body.codigoBono,
        usuarioVendedor: req.user?.usuario ?? 'sistema',
        rolVendedor: req.user?.rol,
      });
      return res.status(201).json({ data: out });
    } catch (e) {
      next(e);
    }
  };
}

