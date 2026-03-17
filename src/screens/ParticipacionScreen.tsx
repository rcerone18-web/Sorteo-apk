import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSync } from '../context/SyncContext';
import * as db from '../db';
import * as api from '../api/client';
import { isOnline } from '../sync/syncService';
import { ejecutarSorteoLocal } from '../utils/sorteo';
import { guardarConfigCache, obtenerConfigCache } from '../db';

export default function ParticipacionScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const navParams = (route.params ?? {}) as { numeroFactura?: string };
  const { refrescarPendientes } = useSync();
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
          setFechaFactura(v.fechaFactura);
          setCedulaCliente(v.cedulaCliente);
          setNombreCliente(v.nombreCliente);
          setValorTotal(String(v.valorTotal));
        } else {
          setFechaFactura('');
          setCedulaCliente('');
          setNombreCliente('');
          setValorTotal('');
        }
      } else {
        const v = await db.ventaPorNumero(numero.trim());
        if (v) {
          setFechaFactura(v.fechaFactura);
          setCedulaCliente(v.cedulaCliente);
          setNombreCliente(v.nombreCliente);
          setValorTotal(String(v.valorTotal));
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
    const valor = parseFloat(valorTotal);
    if (isNaN(valor) || valor < 0) {
      Alert.alert('Error', 'Valor total inválido');
      return;
    }
    setLoadingSubmit(true);
    setShowRoulette(true);
    setPendingNavParams(null);
    setRouletteDone(false);
    setRouletteText('Validando...');
    try {
      const online = await isOnline();
      const tabNav = navigation.getParent();
      const rootNav = (tabNav as { getParent?: () => { navigate: (a: string, b: object) => void } } | undefined)?.getParent?.();
      if (online) {
        setRouletteText('Validando factura...');
        try {
          const validada = await api.validarFactura(numeroFactura.trim());
          if (!validada) {
            setShowRoulette(false);
            Alert.alert('Error', 'Factura no encontrada o no participa (redimió bono o ya participó).');
            return;
          }
        } catch (validarError: unknown) {
          setShowRoulette(false);
          const res = (validarError as { response?: { data?: { error?: string; presentacionesRequeridas?: string[] }; status?: number } })?.response;
          const msg = res?.status === 403 && Array.isArray(res?.data?.presentacionesRequeridas) && res.data.presentacionesRequeridas.length > 0
            ? `No puedes participar porque esta factura no incluye ninguna de las referencias seleccionadas.\n\nPara participar debes comprar al menos una de estas presentaciones:\n${res.data.presentacionesRequeridas.join(', ')}`
            : res?.data?.error || (validarError instanceof Error ? (validarError as Error).message : 'No se puede participar con esta factura.');
          Alert.alert('Error', msg);
          return;
        }
        setRouletteText('Ejecutando sorteo...');
        const resultado = await api.crearParticipacion({
          numeroFactura: numeroFactura.trim(),
          fechaFactura: fechaFactura || new Date().toISOString().slice(0, 10),
          cedulaCliente: cedulaCliente.trim(),
          nombreCliente: nombreCliente.trim(),
          valorTotal: valor,
          consentimientoDatos: consentimiento,
        });
        const gano = resultado.gana ?? resultado.gano ?? false;
        runSpinTo(gano);
        const nav = {
          gano,
          codigoBono: resultado.codigoBono,
          compraMinimaBono: resultado.compraMinimaBono,
          mensaje: resultado.mensaje,
          offline: false,
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
          fechaFactura: fechaFactura || new Date().toISOString().slice(0, 10),
          cedulaCliente: cedulaCliente.trim(),
          nombreCliente: nombreCliente.trim(),
          valorTotal: valor,
          consentimientoDatos: consentimiento,
          resultado: gano ? 'gano' : 'no_gano',
          codigoBono: resultado.codigoBono,
          compraMinimaBono: resultado.compraMinimaBono,
        });
        await refrescarPendientes();
        const nav = {
          gano,
          codigoBono: resultado.codigoBono,
          compraMinimaBono: resultado.compraMinimaBono,
          mensaje: resultado.mensaje,
          offline: true,
        };
        setPendingNavParams(nav);
      }
    } catch (e: unknown) {
      setShowRoulette(false);
      const res = (e as { response?: { data?: { error?: string; presentacionesRequeridas?: string[] }; status?: number } })?.response;
      const msg = res?.status === 403 && Array.isArray(res?.data?.presentacionesRequeridas) && res.data.presentacionesRequeridas.length > 0
        ? `No puedes participar porque esta factura no incluye ninguna de las referencias seleccionadas.\n\nPara participar debes comprar al menos una de estas presentaciones:\n${res.data.presentacionesRequeridas.join(', ')}`
        : res?.data?.error || (e instanceof Error ? (e as Error).message : 'No se pudo registrar la participación');
      Alert.alert('Error', msg);
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.section}>Datos de la participación</Text>
      <TextInput
        style={styles.input}
        placeholder="Número de factura"
        value={numeroFactura}
        onChangeText={setNumeroFactura}
        onBlur={() => buscarFactura(numeroFactura)}
        editable={!loadingAutocomplete}
      />
      {loadingAutocomplete && <ActivityIndicator style={styles.loader} />}
      <TextInput
        style={styles.input}
        placeholder="Fecha factura"
        value={fechaFactura}
        onChangeText={setFechaFactura}
      />
      <TextInput
        style={styles.input}
        placeholder="Cédula"
        value={cedulaCliente}
        onChangeText={setCedulaCliente}
      />
      <TextInput
        style={styles.input}
        placeholder="Nombre cliente"
        value={nombreCliente}
        onChangeText={setNombreCliente}
      />
      <TextInput
        style={styles.input}
        placeholder="Valor total"
        value={valorTotal}
        onChangeText={setValorTotal}
        keyboardType="numeric"
      />
      <TouchableOpacity
        style={[styles.checkRow, consentimiento && styles.checkRowOn]}
        onPress={() => setConsentimiento((c) => !c)}
      >
        <Text style={styles.checkText}>Acepto consentimiento de uso de datos</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, loadingSubmit && styles.buttonDisabled]}
        onPress={enviar}
        disabled={loadingSubmit}
      >
        {loadingSubmit ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Participar en el sorteo</Text>
        )}
      </TouchableOpacity>

      {/* Ruleta al participar */}
      <Modal visible={showRoulette} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sorteo</Text>
            <View style={styles.rouletteWrapper}>
              <Animated.View style={[styles.roulette, { transform: [{ rotate: spin }] }]}>
                <View style={[styles.half, styles.halfGanaste]}>
                  <Text style={styles.halfText}>¡Felicidades, ganaste!</Text>
                </View>
                <View style={[styles.half, styles.halfNoGano]}>
                  <Text style={styles.halfText}>No ganaste</Text>
                </View>
              </Animated.View>
              <View style={styles.pointer} />
            </View>
            <Text style={styles.modalStatus}>{rouletteText}</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary, !pendingNavParams?.gano && styles.modalBtnFull]}
                onPress={() => {
                  setShowRoulette(false);
                  setPendingNavParams(null);
                  const tabNav = navigation.getParent();
                  const rootNav = (tabNav as { getParent?: () => { navigate: (a: string, b?: object) => void } } | undefined)?.getParent?.();
                  rootNav?.navigate('Main', { screen: 'Facturacion' });
                }}
                disabled={!rouletteDone}
              >
                <Text style={styles.modalBtnText}>Registrar otra venta</Text>
              </TouchableOpacity>
              {pendingNavParams?.gano ? (
                <TouchableOpacity
                  style={[styles.modalBtn, (!rouletteDone || !pendingNavParams) && styles.buttonDisabled]}
                  disabled={!rouletteDone || !pendingNavParams}
                  onPress={() => {
                    if (!pendingNavParams) return;
                    const params = {
                      gano: !!pendingNavParams.gano,
                      codigoBono: pendingNavParams.codigoBono ?? undefined,
                      compraMinimaBono: pendingNavParams.compraMinimaBono ?? undefined,
                      mensaje: pendingNavParams.mensaje ?? '',
                      offline: !!pendingNavParams.offline,
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
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  section: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 8 },
  loader: { marginBottom: 8 },
  checkRow: { padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, backgroundColor: '#fff' },
  checkRowOn: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  checkText: { fontSize: 15, color: '#334155' },
  button: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12, textAlign: 'center' },
  modalStatus: { fontSize: 14, color: '#334155', textAlign: 'center', marginTop: 10 },
  modalButtons: { flexDirection: 'row', marginTop: 14 },
  modalBtn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, padding: 12, alignItems: 'center' },
  modalBtnSecondary: { backgroundColor: '#475569', marginRight: 10 },
  modalBtnFull: { marginRight: 0 },
  modalBtnText: { color: '#fff', fontWeight: '700' },

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
