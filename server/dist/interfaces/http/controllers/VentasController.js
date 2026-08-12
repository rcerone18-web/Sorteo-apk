"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VentasController = void 0;
class VentasController {
    crearVentaUseCase;
    constructor(crearVentaUseCase) {
        this.crearVentaUseCase = crearVentaUseCase;
    }
    crearVenta = async (req, res, next) => {
        try {
            const body = req.body;
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
        }
        catch (e) {
            next(e);
        }
    };
}
exports.VentasController = VentasController;
