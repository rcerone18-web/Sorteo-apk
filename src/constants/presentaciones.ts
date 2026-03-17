/**
 * Presentaciones por cartón y precios de referencia (Colombia, basados en referencias de mercado/Corabastos).
 * Ventas por cartones. Los precios se pueden ajustar según tu negocio.
 */
export interface PresentacionOption {
  nombre: string;
  precioUnitario: number; // precio por cartón (COP)
}

export const PRESENTACIONES: PresentacionOption[] = [
  { nombre: 'EXTRA', precioUnitario: 16000 },
  { nombre: 'AA', precioUnitario: 13500 },
  { nombre: 'A', precioUnitario: 12000 },
  { nombre: 'B', precioUnitario: 11000 },
  { nombre: 'PIPO', precioUnitario: 10000 },
  { nombre: 'PICADO', precioUnitario: 9500 },
  { nombre: 'SUCIO', precioUnitario: 9000 },
  { nombre: 'A ESTUCHE X 6', precioUnitario: 6000 },
  { nombre: 'A ESTUCHE X 12', precioUnitario: 11000 },
  { nombre: 'AA ESTUCHE X 12', precioUnitario: 12000 },
  { nombre: 'ELITE ESTUCHE X 12', precioUnitario: 13000 },
  { nombre: 'AA ESTUCHE X 30', precioUnitario: 13500 },
  { nombre: 'A AMARRE X 30', precioUnitario: 12000 },
  { nombre: 'B AMARRE X 30', precioUnitario: 11000 },
];
