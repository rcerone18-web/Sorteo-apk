import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSync } from '../context/SyncContext';
import * as db from '../db';
import * as api from '../api/client';
import { isOnline } from '../sync/syncService';
import { ejecutarSorteoLocal } from '../utils/sorteo';
import { randomUUID } from '../utils/uuid';
import { guardarConfigCache, obtenerConfigCache } from '../db';
import { useAppTheme } from '../theme/ThemeProvider';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { errorToAlertMessage } from '../utils/errors';
import { localCalendarYmd, toCalendarYmdFromApi } from '../utils/localDate';

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatCopNoDecimals(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return '';
  return currencyFormatter.format(n);
}

function parseCopInput(value: string) {
  // Soporta valores como: "273000.00", "$273.000", "273.000"
  const clean = value.trim().replace(/[^0-9.,-]/g, '');
  if (!clean) return NaN;

  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');
  const lastSepIdx = Math.max(lastDot, lastComma);
  if (lastSepIdx === -1) {
    const asNumber = Number(clean);
    return Number.isNaN(asNumber) ? NaN : asNumber;
  }

  const sepChar = clean[lastSepIdx];
  const digitsAfter = clean.length - lastSepIdx - 1;

  // Si tiene 2 dígitos después del separador, lo tratamos como decimal (ej: 273000.00)
  if (digitsAfter === 2) {
    const integerPart = clean.slice(0, lastSepIdx).replace(/[.,]/g, '');
    const fractionPart = clean.slice(lastSepIdx + 1);
    const normalized = `${integerPart}.${fractionPart}`;
    const asNumber = parseFloat(normalized);
    return Number.isNaN(asNumber) ? NaN : asNumber;
  }

  // Si no tiene 2 dígitos después, lo tratamos como separador de miles (ej: 273.000)
  const asNumber = parseFloat(clean.replace(/[.,]/g, ''));
  return Number.isNaN(asNumber) ? NaN : asNumber;
}

export default function ParticipacionScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const navParams = (route.params ?? {}) as { numeroFactura?: string };
  const { refrescarPendientes } = useSync();
  const { theme } = useAppTheme();
  const numeroInicial = navParams.numeroFactura ?? '';
  const [numeroFactura, setNumeroFactura] = useState(numeroInicial);
  const [fechaFactura, setFechaFactura] = useState('');
  const [cedulaCliente, setCedulaCliente] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);
  const [loadingAutocomplete, setLoadingAutocomplete] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteText, setRouletteText] = useState<string>('Girando...');
  const [rouletteDone, setRouletteDone] = useState(false);
  const [pendingNavParams, setPendingNavParams] = useState<{
    gano: boolean;
    codigoBono?: string;
    compraMinimaBono?: number;
    mensaje: string;
    offline: boolean;
    leyendaFacturaBono?: string;
    probabilidadUtilizada?: number;
  } | null>(null);

  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const runSpinTo = (gano: boolean) => {
    spinValue.setValue(0);
    setRouletteDone(false);
    setRouletteText('Girando...');
    // 0° = verde (ganaste) arriba; 180° = rojo (no ganaste) arriba. 4 vueltas = verde, 4.5 vueltas = rojo.
    const targetTurns = gano ? 4.0 : 4.5;
    Animated.timing(spinValue, {
      toValue: targetTurns,
      duration: 2200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setRouletteDone(true);
      setRouletteText(gano ? '¡Felicidades, ganaste!' : 'No ganaste');
    });
  };

  const buscarFactura = async (numero: string) => {
    if (!numero.trim()) return;
    setLoadingAutocomplete(true);
    try {
      const online = await isOnline();
      if (online) {
        const v = await api.getVentaPorNumero(numero.trim());
        if (v) {
          setFechaFactura(toCalendarYmdFromApi(v.fechaFactura));
          setCedulaCliente(v.cedulaCliente);
          setNombreCliente(v.nombreCliente);
          setValorTotal(formatCopNoDecimals(v.valorTotal));
        } else {
          setFechaFactura('');
          setCedulaCliente('');
          setNombreCliente('');
          setValorTotal('');
        }
      } else {
        const v = await db.ventaPorNumero(numero.trim());
        if (v) {
          setFechaFactura(toCalendarYmdFromApi(v.fechaFactura));
          setCedulaCliente(v.cedulaCliente);
          setNombreCliente(v.nombreCliente);
          setValorTotal(formatCopNoDecimals(v.valorTotal));
        } else {
          setFechaFactura('');
          setCedulaCliente('');
          setNombreCliente('');
          setValorTotal('');
        }
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo buscar la factura');
    } finally {
      setLoadingAutocomplete(false);
    }
  };

  // Al montar o al recibir número de factura por params (ej. desde "Ir a participación")
  useEffect(() => {
    const num = navParams.numeroFactura ?? '';
    if (num) {
      setNumeroFactura(num);
      buscarFactura(num);
    }
  }, [navParams.numeroFactura]);

  const enviar = async () => {
    if (!numeroFactura.trim()) {
      Alert.alert('Error', 'Ingresa el número de factura');
      return;
    }
    if (!consentimiento) {
      Alert.alert('Error', 'Debes aceptar el consentimiento de datos');
      return;
    }
    const valor = parseCopInput(valorTotal);
    if (isNaN(valor) || valor < 0) {
      Alert.alert('Error', 'Valor total inválido');
      return;
    }
    setLoadingSubmit(true);
    setShowRoulette(true);
    setPendingNavParams(null);
    setRouletteDone(false);
    setRouletteText('Validando...');
    const idempotencyKey = randomUUID();
    try {
      const online = await isOnline();
      const tabNav = navigation.getParent();
      const rootNav = (tabNav as { getParent?: () => { navigate: (a: string, b: object) => void } } | undefined)?.getParent?.();
      if (online) {
        setRouletteText('Validando factura...');
        try {
          await api.validarFactura(numeroFactura.trim());
        } catch (validarError: unknown) {
          setShowRoulette(false);
          const res = (validarError as { response?: { data?: { error?: string; presentacionesRequeridas?: string[] }; status?: number } })?.response;
          const msg =
            res?.status === 403 && Array.isArray(res?.data?.presentacionesRequeridas) && res.data.presentacionesRequeridas.length > 0
              ? `No puedes participar porque esta factura no incluye ninguna de las referencias seleccionadas.\n\nPara participar debes comprar al menos una de estas presentaciones:\n${res.data.presentacionesRequeridas.join(', ')}`
              : errorToAlertMessage(
                  res?.data?.error,
                  validarError instanceof Error ? validarError.message : 'No se puede participar con esta factura.'
                );
          Alert.alert('Error', msg);
          return;
        }
        setRouletteText('Ejecutando sorteo...');
        const resultado = await api.crearParticipacion({
          numeroFactura: numeroFactura.trim(),
          fechaFactura: fechaFactura || localCalendarYmd(),
          cedulaCliente: cedulaCliente.trim(),
          nombreCliente: nombreCliente.trim(),
          valorTotal: valor,
          consentimientoDatos: consentimiento,
          idempotencyKey,
        });
        const gano = resultado.gana ?? resultado.gano ?? false;
        runSpinTo(gano);
        const nav = {
          gano,
          codigoBono: resultado.codigoBono,
          compraMinimaBono: resultado.compraMinimaBono,
          mensaje: resultado.mensaje,
          offline: false,
          leyendaFacturaBono: resultado.leyendaFacturaBono,
          probabilidadUtilizada: resultado.probabilidadUtilizada,
        };
        setPendingNavParams(nav);
      } else {
        setRouletteText('Sin conexión: resultado no confirmado');
        let config = await obtenerConfigCache();
        if (!config) {
          try {
            const c = await api.getConfigSorteo();
            config = c;
            await guardarConfigCache(c);
          } catch {
            config = { probabilidadGanar: 0.1, compraMinimaBono: 100000, presentacionesParticipan: [] };
          }
        }
        const resultado = ejecutarSorteoLocal(config.probabilidadGanar, config.compraMinimaBono);
        const gano = resultado.gano ?? false;
        runSpinTo(gano);
        await db.guardarParticipacionLocal({
          numeroFactura: numeroFactura.trim(),
          fechaFactura: fechaFactura || localCalendarYmd(),
          cedulaCliente: cedulaCliente.trim(),
          nombreCliente: nombreCliente.trim(),
          valorTotal: valor,
          consentimientoDatos: consentimiento,
          resultado: gano ? 'gano' : 'no_gano',
          codigoBono: resultado.codigoBono,
          compraMinimaBono: resultado.compraMinimaBono,
          idempotencyKey,
        });
        await refrescarPendientes();
        const nav = {
          gano,
          codigoBono: resultado.codigoBono,
          compraMinimaBono: resultado.compraMinimaBono,
          mensaje: resultado.mensaje,
          offline: true,
          leyendaFacturaBono: 'ESTA FACTURA CONTIENE UN BONO',
        };
        setPendingNavParams(nav);
      }
    } catch (e: unknown) {
      setShowRoulette(false);
      const res = (e as { response?: { data?: { error?: unknown; presentacionesRequeridas?: string[] }; status?: number } })?.response;
      const msg =
        res?.status === 403 && Array.isArray(res?.data?.presentacionesRequeridas) && res.data.presentacionesRequeridas.length > 0
          ? `No puedes participar porque esta factura no incluye ninguna de las referencias seleccionadas.\n\nPara participar debes comprar al menos una de estas presentaciones:\n${res.data.presentacionesRequeridas.join(', ')}`
          : errorToAlertMessage(
              res?.data?.error,
              e instanceof Error ? e.message : 'No se pudo registrar la participación'
            );
      Alert.alert('Error', msg);
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.block}>
        <Text style={[styles.section, { color: theme.colors.text }]}>Datos de la participación</Text>

        <Input
          placeholder="Número de factura"
          value={numeroFactura}
          onChangeText={setNumeroFactura}
          onBlur={() => buscarFactura(numeroFactura)}
          editable={!loadingAutocomplete}
        />
        {loadingAutocomplete && <ActivityIndicator style={styles.loader} />}

        <View style={{ height: 10 }} />
        <Input placeholder="Fecha factura" value={fechaFactura} onChangeText={setFechaFactura} />

        <View style={{ height: 10 }} />
        <Input
          placeholder="Cédula"
          value={cedulaCliente}
          onChangeText={(t) => setCedulaCliente(t.replace(/\D+/g, ''))}
          keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
          inputMode="numeric"
        />

        <View style={{ height: 10 }} />
        <Input placeholder="Nombre cliente" value={nombreCliente} onChangeText={setNombreCliente} />

        <View style={{ height: 10 }} />
        <Input
          placeholder="Valor total"
          value={valorTotal}
          onChangeText={setValorTotal}
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={[
            styles.checkRow,
            consentimiento && styles.checkRowOn,
            { borderColor: theme.colors.border, backgroundColor: consentimiento ? '#eff6ff' : theme.colors.card },
          ]}
          onPress={() => setConsentimiento((c) => !c)}
        >
          <Text style={[styles.checkText, { color: theme.colors.text }]}>Acepto consentimiento de uso de datos</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 14 }}>
          <Button
            title="Participar en el sorteo"
            onPress={enviar}
            loading={loadingSubmit}
            disabled={loadingSubmit}
            variant="primary"
          />
        </View>
      </Card>

      {/* Ruleta al participar */}
      <Modal visible={showRoulette} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Sorteo</Text>
            <View style={styles.rouletteWrapper}>
              <Animated.View style={[styles.roulette, { transform: [{ rotate: spin }], borderColor: theme.colors.primary }]}>
                <View style={[styles.half, styles.halfGanaste]}>
                  <Text style={styles.halfText}>¡Felicidades, ganaste!</Text>
                </View>
                <View style={[styles.half, styles.halfNoGano]}>
                  <Text style={styles.halfText}>No ganaste</Text>
                </View>
              </Animated.View>
              <View style={styles.pointer} />
            </View>
            <Text style={[styles.modalStatus, { color: theme.colors.mutedText }]}>{rouletteText}</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnSecondary,
                  !pendingNavParams?.gano && styles.modalBtnFull,
                  {
                    backgroundColor: pendingNavParams?.gano ? theme.colors.border : theme.colors.primary,
                  },
                ]}
                onPress={() => {
                  setShowRoulette(false);
                  setPendingNavParams(null);
                  // Navegar a Ventas (Facturación) a través del stack raíz:
                  // Participacion está dentro de Tabs (Main) que a su vez está dentro del Stack raíz.
                  const navAny = navigation as unknown as {
                    navigate?: (name: string, params?: any) => void;
                    getParent?: () => { navigate?: (name: string, params?: any) => void } | undefined;
                  };
                  const rootStack = navAny.getParent?.();
                  // Preferido: Stack raíz → Main → Tab Facturacion (evita warning de rutas desconocidas).
                  rootStack?.navigate?.('Main', { screen: 'Facturacion' });
                  // Fallback (si por alguna razón no hay parent): navegar en tabs.
                  if (!rootStack?.navigate) {
                    navAny.navigate?.('Facturacion');
                  }
                }}
                disabled={!rouletteDone}
              >
                <Text
                  style={[
                    styles.modalBtnText,
                    {
                      color: pendingNavParams?.gano ? theme.colors.text : '#FFFFFF',
                    },
                  ]}
                >
                  Registrar otra venta
                </Text>
              </TouchableOpacity>
              {pendingNavParams?.gano ? (
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    (!rouletteDone || !pendingNavParams) && styles.buttonDisabled,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  disabled={!rouletteDone || !pendingNavParams}
                  onPress={() => {
                    if (!pendingNavParams) return;
                    const params = {
                      gano: !!pendingNavParams.gano,
                      codigoBono: pendingNavParams.codigoBono ?? undefined,
                      compraMinimaBono: pendingNavParams.compraMinimaBono ?? undefined,
                      mensaje: pendingNavParams.mensaje ?? '',
                      offline: !!pendingNavParams.offline,
                      leyendaFacturaBono: pendingNavParams.leyendaFacturaBono,
                      probabilidadUtilizada: pendingNavParams.probabilidadUtilizada,
                    };
                    setShowRoulette(false);
                    // Preferir bubbling de React Navigation; fallback a root navigator si hace falta
                    const navAny = navigation as unknown as { navigate?: (name: string, params?: object) => void; getParent?: () => unknown };
                    navAny.navigate?.('ResultadoSorteo', params);
                    const tabNav = navAny.getParent?.() as { getParent?: () => unknown } | undefined;
                    const rootNav = (tabNav as { getParent?: () => { navigate?: (a: string, b?: object) => void } } | undefined)?.getParent?.();
                    rootNav?.navigate?.('ResultadoSorteo', params);
                  }}
                >
                  <Text style={styles.modalBtnText}>Ver resultado</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  block: { marginBottom: 16 },
  section: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  loader: { marginBottom: 8 },
  checkRow: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  checkRowOn: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  checkText: { fontSize: 15, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 14, padding: 16, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  modalStatus: { fontSize: 14, textAlign: 'center', marginTop: 10 },
  modalButtons: { flexDirection: 'row', marginTop: 14 },
  modalBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  modalBtnSecondary: { marginRight: 10 },
  modalBtnFull: { marginRight: 0 },
  modalBtnText: { color: '#fff', fontWeight: '700' },
  buttonDisabled: { opacity: 0.45 },

  rouletteWrapper: { alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  roulette: {
    width: 220,
    height: 220,
    borderRadius: 110,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#1e3a5f',
  },
  half: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  halfGanaste: { backgroundColor: '#bbf7d0' },
  halfNoGano: { backgroundColor: '#fee2e2' },
  halfText: { fontSize: 14, fontWeight: '700', color: '#1e293b', textAlign: 'center', paddingHorizontal: 10 },
  pointer: {
    position: 'absolute',
    top: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 18,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#f97316',
  },
});
