import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSync } from '../context/SyncContext';
import * as db from '../db';
import * as api from '../api/client';
import { isOnline } from '../sync/syncService';
import type { ItemFactura } from '../types';
import { PRESENTACIONES } from '../constants/presentaciones';
import { useAppTheme } from '../theme/ThemeProvider';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const INIT_ITEM: ItemFactura = { tipoPresentacion: '', cantidad: 0, precioUnitario: 0, subtotal: 0 };

function presentacionesToItems(presentaciones: { presentacion: string; cantidad: number }[]): ItemFactura[] {
  const map = new Map(PRESENTACIONES.map((p) => [p.nombre, p.precioUnitario]));
  return presentaciones.map(({ presentacion, cantidad }) => {
    const precioUnitario = map.get(presentacion) ?? 0;
    return {
      tipoPresentacion: presentacion,
      cantidad,
      precioUnitario,
      subtotal: cantidad * precioUnitario,
    };
  });
}

export default function FacturacionScreen() {
  const navigation = useNavigation<{ navigate: (a: string, b?: { numeroFactura: string }) => void }>();
  const { refrescarPendientes } = useSync();
  const { theme } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [loadingAutocomplete, setLoadingAutocomplete] = useState(false);
  const [fechaFactura, setFechaFactura] = useState(() => new Date().toISOString().slice(0, 10));
  const [cedulaCliente, setCedulaCliente] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [totalHuevos, setTotalHuevos] = useState('');
  const [codigoBono, setCodigoBono] = useState('');
  const [compraMinimaBono, setCompraMinimaBono] = useState<number | null>(null);
  const [numeroFacturaRef, setNumeroFacturaRef] = useState('');
  const [items, setItems] = useState<ItemFactura[]>([{ ...INIT_ITEM }]);
  const [numeroFacturaGuardada, setNumeroFacturaGuardada] = useState<string | null>(null);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const cedulaRef = useRef('');
  const numeroFacturaRefRef = useRef('');
  const codigoBonoRef = useRef('');

  const autocompletarPorCedula = useCallback(async (cedulaActual?: string) => {
    const cedula = (cedulaActual !== undefined ? cedulaActual : cedulaCliente).trim();
    if (!cedula) return;
    setLoadingAutocomplete(true);
    try {
      const online = await isOnline();
      if (online) {
        const v = await api.getVentaPorCedula(cedula);
        if (v) {
          setNombreCliente(v.nombreCliente ?? '');
        }
      } else {
        const v = await db.ultimaVentaPorCedula(cedula);
        if (v) {
          setNombreCliente(v.nombreCliente ?? '');
        }
      }
    } catch {
      // 404 o error: no autocompletar
    } finally {
      setLoadingAutocomplete(false);
    }
  }, [cedulaCliente, fechaFactura]);

  const cargarCompraMinimaBono = useCallback(async () => {
    const codigo = codigoBonoRef.current.trim();
    if (!codigo) {
      setCompraMinimaBono(null);
      return;
    }
    try {
      const online = await isOnline();
      if (online) {
        const minima = await api.getCompraMinima();
        setCompraMinimaBono(minima);
      } else {
        setCompraMinimaBono(null);
      }
    } catch {
      setCompraMinimaBono(null);
    }
  }, []);

  const autocompletarPorFactura = useCallback(async (numeroActual?: string) => {
    const numero = (numeroActual !== undefined ? numeroActual : numeroFacturaRef).trim();
    if (!numero) return;
    setLoadingAutocomplete(true);
    try {
      const online = await isOnline();
      if (online) {
        const v = await api.getVentaPorNumero(numero);
        if (v) {
          setCedulaCliente(v.cedulaCliente);
          setNombreCliente(v.nombreCliente);
          setFechaFactura(v.fechaFactura?.slice(0, 10) ?? fechaFactura);
          setValorTotal(String(v.valorTotal ?? ''));
          setTotalHuevos(v.totalHuevos != null ? String(v.totalHuevos) : '');
          if (v.presentaciones?.length) {
            setItems([...presentacionesToItems(v.presentaciones), { ...INIT_ITEM }]);
          }
        }
      } else {
        const v = await db.ventaPorNumero(numero);
        if (v) {
          setCedulaCliente(v.cedulaCliente);
          setNombreCliente(v.nombreCliente);
          setFechaFactura(v.fechaFactura?.slice(0, 10) ?? fechaFactura);
          setValorTotal(String(v.valorTotal ?? ''));
          setTotalHuevos(v.totalHuevos != null ? String(v.totalHuevos) : '');
          if (v.items?.length) {
            setItems([...v.items, { ...INIT_ITEM }]);
          }
        }
      }
    } catch {
      // 404 o error
    } finally {
      setLoadingAutocomplete(false);
    }
  }, [numeroFacturaRef, fechaFactura]);

  const addItem = () => setItems((prev) => [...prev, { ...INIT_ITEM }]);
  const updateItem = (i: number, f: Partial<ItemFactura>) => {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...f };
      next[i].subtotal = (next[i].cantidad || 0) * (next[i].precioUnitario || 0);
      return next;
    });
  };
  const removeItem = (i: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const recalcTotal = () => {
    const total = items.reduce((s, it) => s + (it.subtotal || 0), 0);
    setValorTotal(String(total));
  };

  const totalSinDescuento = items.reduce((s, it) => s + (it.subtotal || 0), 0);
  const bonoAplicable =
    codigoBono.trim() !== '' &&
    compraMinimaBono != null &&
    totalSinDescuento >= compraMinimaBono;
  const descuentoBono = bonoAplicable ? totalSinDescuento * 0.5 : 0;
  const totalConDescuento = bonoAplicable ? totalSinDescuento - descuentoBono : totalSinDescuento;

  const selectPresentacion = (index: number, nombre: string, precioUnitario: number) => {
    if (pickerIndex === null) return;
    updateItem(pickerIndex, { tipoPresentacion: nombre, precioUnitario });
    setPickerIndex(null);
    setTimeout(recalcTotal, 0);
  };

  const guardar = async () => {
    if (!cedulaCliente.trim() || !nombreCliente.trim()) {
      Alert.alert('Error', 'Cédula y nombre del cliente son obligatorios');
      return;
    }
    const itemsValidos = items.filter((it) => it.tipoPresentacion && it.cantidad > 0 && it.precioUnitario >= 0);
    if (itemsValidos.length === 0) {
      Alert.alert('Error', 'Agrega al menos un ítem con presentación, cantidad y precio');
      return;
    }
    const valor = itemsValidos.reduce((s, it) => s + it.cantidad * it.precioUnitario, 0);
    if (valor <= 0) {
      Alert.alert('Error', 'Valor total inválido');
      return;
    }
    setLoading(true);
    try {
      const online = await isOnline();
      if (online) {
        const presentaciones = itemsValidos.map((i) => ({ presentacion: i.tipoPresentacion, cantidad: i.cantidad }));
        const res = await api.crearVenta({
          fechaFactura,
          cedulaCliente: cedulaCliente.trim(),
          nombreCliente: nombreCliente.trim(),
          valorTotal: valor,
          totalHuevos: totalHuevos ? parseInt(totalHuevos, 10) : undefined,
          presentaciones,
          codigoBono: codigoBono.trim() || undefined,
        });
        setNumeroFacturaGuardada(res.numero);
        Alert.alert('Guardado', `Factura ${res.numero} registrada.`, [
          { text: 'Ir a participación', onPress: () => navigation.navigate('Participacion', { numeroFactura: res.numero }) },
          { text: 'OK' },
        ]);
      } else {
        const numeroLocal = await db.siguienteNumeroLocal();
        await db.guardarVentaLocal({
          numeroFactura: numeroLocal,
          fechaFactura,
          cedulaCliente: cedulaCliente.trim(),
          nombreCliente: nombreCliente.trim(),
          valorTotal: valor,
          totalHuevos: totalHuevos ? parseInt(totalHuevos, 10) : undefined,
          items: itemsValidos,
          codigoBonoRedimido: codigoBono.trim() || undefined,
        });
        setNumeroFacturaGuardada(numeroLocal);
        await refrescarPendientes();
        Alert.alert(
          'Guardado (sin conexión)',
          `Factura ${numeroLocal} guardada localmente. Sincroniza cuando haya internet.`,
          [
            { text: 'Ir a participación', onPress: () => navigation.navigate('Participacion', { numeroFactura: numeroLocal }) },
            { text: 'OK' },
          ]
        );
      }
      limpiar();
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { error?: unknown; compraMinimaRequerida?: number }; status?: number };
      };
      const serverError = err?.response?.data?.error;
      let msg: string;
      if (typeof serverError === 'string') msg = serverError;
      else if (serverError && typeof serverError === 'object' && 'message' in serverError) msg = String((serverError as any).message);
      else msg = e instanceof Error ? e.message : 'No se pudo guardar la venta';
      if (err?.response?.status === 422 && err?.response?.data?.compraMinimaRequerida != null) {
        msg += ` Requiere compra mínima: $${Number(err.response.data.compraMinimaRequerida).toLocaleString('es-CO')}.`;
      }
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const limpiar = () => {
    setCedulaCliente('');
    setNombreCliente('');
    setValorTotal('');
    setTotalHuevos('');
    setCodigoBono('');
    codigoBonoRef.current = '';
    setCompraMinimaBono(null);
    setNumeroFacturaRef('');
    setItems([{ ...INIT_ITEM }]);
    // Mantener numeroFacturaGuardada para que se vea "Última factura: F-xxx"
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.section, { color: theme.colors.text }]}>Autocompletar por factura o cédula</Text>
      <Input
        icon="receipt-outline"
        placeholder="Nº factura (autocompletar datos)"
        value={numeroFacturaRef}
        onChangeText={(t) => {
          numeroFacturaRefRef.current = t;
          setNumeroFacturaRef(t);
        }}
        onBlur={() => autocompletarPorFactura(numeroFacturaRefRef.current)}
      />
      <Text style={[styles.section, { color: theme.colors.text }]}>Datos del cliente</Text>
      <Input
        icon="person-outline"
        placeholder="Cédula"
        value={cedulaCliente}
        onChangeText={(t) => {
          const onlyDigits = t.replace(/\D+/g, '');
          cedulaRef.current = onlyDigits;
          setCedulaCliente(onlyDigits);
        }}
        onBlur={() => autocompletarPorCedula(cedulaRef.current)}
        keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
        inputMode="numeric"
      />
      {loadingAutocomplete && <ActivityIndicator style={styles.loader} size="small" />}
      <Input icon="person-circle-outline" placeholder="Nombre cliente" value={nombreCliente} onChangeText={setNombreCliente} />
      <Input placeholder="Fecha factura (YYYY-MM-DD)" value={fechaFactura} onChangeText={setFechaFactura} />
      <Input
        icon="egg-outline"
        placeholder="Total huevos (opcional)"
        value={totalHuevos}
        onChangeText={setTotalHuevos}
        keyboardType="numeric"
        inputMode="numeric"
      />
      <Input
        icon="pricetag-outline"
        placeholder="Código bono (opcional, 50% próxima compra)"
        value={codigoBono}
        onChangeText={(t) => {
          setCodigoBono(t);
          codigoBonoRef.current = t;
          if (!t.trim()) setCompraMinimaBono(null);
        }}
        onBlur={() => cargarCompraMinimaBono()}
      />
      <Text style={[styles.section, { color: theme.colors.text }]}>Ítems por presentación (venta por cartones)</Text>
      {items.map((it, i) => (
        <View key={i} style={styles.itemRow}>
          <TouchableOpacity
            style={[styles.input, styles.inputPresentacion, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => setPickerIndex(i)}
          >
            <Text style={[it.tipoPresentacion ? styles.pickerText : styles.pickerPlaceholder, { color: it.tipoPresentacion ? theme.colors.text : theme.colors.mutedText }]}>
              {it.tipoPresentacion || 'Seleccionar presentación'}
            </Text>
            {it.tipoPresentacion ? (
              <Text style={[styles.precioRef, { color: theme.colors.mutedText }]}>${(it.precioUnitario || 0).toLocaleString('es-CO')}/cartón</Text>
            ) : null}
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <Text style={[styles.inputLabel, { color: theme.colors.mutedText }]}>Cant.</Text>
            <TextInput
              style={[styles.input, styles.inputCant, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="0"
              placeholderTextColor={theme.colors.mutedText}
              value={it.cantidad ? String(it.cantidad) : ''}
              onChangeText={(t) => updateItem(i, { cantidad: parseInt(t, 10) || 0 })}
              onBlur={recalcTotal}
              keyboardType="numeric"
              inputMode="numeric"
            />
          </View>
          <View style={styles.inputWrap}>
            <Text style={[styles.inputLabel, { color: theme.colors.mutedText }]}>Precio</Text>
            <TextInput
              style={[styles.input, styles.inputPrecio, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="0"
              placeholderTextColor={theme.colors.mutedText}
              value={it.precioUnitario ? String(it.precioUnitario) : ''}
              onChangeText={(t) => updateItem(i, { precioUnitario: parseFloat(t) || 0 })}
              onBlur={recalcTotal}
              keyboardType="numeric"
              inputMode="numeric"
            />
          </View>
          <TouchableOpacity onPress={() => removeItem(i)} style={[styles.removeBtn, { backgroundColor: theme.colors.primary + '33' }]}>
            <Text style={[styles.removeText, { color: theme.colors.primary }]}>−</Text>
          </TouchableOpacity>
        </View>
      ))}
      <Modal visible={pickerIndex !== null} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setPickerIndex(null)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar presentación (precio por cartón)</Text>
            <FlatList
              data={PRESENTACIONES}
              keyExtractor={(item) => item.nombre}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => selectPresentacion(pickerIndex!, item.nombre, item.precioUnitario)}
                >
                  <Text style={styles.modalOptionName}>{item.nombre}</Text>
                  <Text style={styles.modalOptionPrecio}>${item.precioUnitario.toLocaleString('es-CO')}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCerrar} onPress={() => setPickerIndex(null)}>
              <Text style={styles.modalCerrarText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      <TouchableOpacity onPress={addItem} style={styles.addBtn}>
        <Text style={[styles.addText, { color: theme.colors.primary }]}>+ Agregar ítem</Text>
      </TouchableOpacity>
      <Input
        icon="cash-outline"
        placeholder="Valor total (COP)"
        value={valorTotal}
        onChangeText={setValorTotal}
        keyboardType="numeric"
        inputMode="numeric"
      />
      {bonoAplicable && (
        <View style={styles.descuentoBox}>
          <Text style={styles.descuentoTitle}>Descuento por bono (50%)</Text>
          <Text style={styles.descuentoLine}>Subtotal: ${totalSinDescuento.toLocaleString('es-CO')}</Text>
          <Text style={styles.descuentoLine}>Descuento: -${descuentoBono.toLocaleString('es-CO')}</Text>
          <Text style={styles.totalConBono}>Total a pagar: ${totalConDescuento.toLocaleString('es-CO')}</Text>
        </View>
      )}
      {codigoBono.trim() && compraMinimaBono != null && totalSinDescuento > 0 && totalSinDescuento < compraMinimaBono && (
        <Text style={styles.bonoMinimaHint}>
          Compra mínima para usar el bono: ${compraMinimaBono.toLocaleString('es-CO')}. Añade más ítems para aplicar el 50%.
        </Text>
      )}
      {numeroFacturaGuardada && (
        <Text style={styles.numeroGuardada}>Última factura: {numeroFacturaGuardada}</Text>
      )}
      <View style={{ marginTop: 14 }}>
        <Button title="Guardar venta" onPress={guardar} loading={loading} disabled={loading} variant="primary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  section: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 8 },
  loader: { marginBottom: 8 },
  inputPresentacion: { flex: 1, justifyContent: 'center', minHeight: 48 },
  inputWrap: { alignItems: 'center' },
  inputLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  inputCant: { width: 72, textAlign: 'center' },
  inputPrecio: { width: 90, textAlign: 'right' },
  pickerText: { fontSize: 15, fontWeight: '500' },
  pickerPlaceholder: { fontSize: 15 },
  precioRef: { fontSize: 12, marginTop: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 8 },
  removeBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  removeText: { fontSize: 18, fontWeight: '700' },
  addBtn: { padding: 12, marginBottom: 8 },
  addText: { fontSize: 16, fontWeight: '600' },
  descuentoBox: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 10, padding: 14, marginBottom: 12 },
  descuentoTitle: { fontSize: 15, fontWeight: '600', color: '#065f46', marginBottom: 8 },
  descuentoLine: { fontSize: 14, color: '#047857', marginBottom: 4 },
  totalConBono: { fontSize: 17, fontWeight: '700', color: '#065f46', marginTop: 6 },
  bonoMinimaHint: { fontSize: 13, color: '#b45309', marginBottom: 8 },
  numeroGuardada: { fontSize: 14, color: '#059669', marginBottom: 8 },
  button: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%', paddingBottom: 24 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#334155', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalOptionName: { fontSize: 16, color: '#1e293b' },
  modalOptionPrecio: { fontSize: 15, fontWeight: '600', color: '#2563eb' },
  modalCerrar: { marginHorizontal: 16, marginTop: 12, padding: 14, backgroundColor: '#e2e8f0', borderRadius: 10, alignItems: 'center' },
  modalCerrarText: { fontSize: 16, fontWeight: '600', color: '#475569' },
});
