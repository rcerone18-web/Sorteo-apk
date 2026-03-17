import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../api/client';
import { PRESENTACIONES } from '../../constants/presentaciones';

export default function AdminConfigScreen() {
  const { user } = useAuth();
  const [loadingProb, setLoadingProb] = useState(false);
  const [loadingCompra, setLoadingCompra] = useState(false);
  const [loadingPres, setLoadingPres] = useState(false);
  const [porcentaje, setPorcentaje] = useState('');
  const [probabilidad, setProbabilidad] = useState<number | null>(null);
  const [compraMinima, setCompraMinima] = useState('');
  const [compraMinimaVal, setCompraMinimaVal] = useState<number | null>(null);
  const [presentaciones, setPresentaciones] = useState<string[]>([]);
  const [presentacionesOpciones] = useState(() => PRESENTACIONES.map((p) => p.nombre));

  const loadProb = useCallback(async () => {
    try {
      const r = await api.getConfigProbabilidad();
      setProbabilidad(r.probabilidad);
      setPorcentaje(String(r.porcentaje));
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'No se pudo cargar probabilidad');
    }
  }, []);

  const loadCompra = useCallback(async () => {
    try {
      const r = await api.getConfigCompraMinima();
      setCompraMinimaVal(r.compraMinima);
      setCompraMinima(String(r.compraMinima));
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'No se pudo cargar compra mínima');
    }
  }, []);

  const loadPres = useCallback(async () => {
    try {
      const r = await api.getConfigPresentacionesParticipar();
      setPresentaciones(r.presentaciones || []);
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'No se pudo cargar presentaciones');
    }
  }, []);

  useEffect(() => {
    if (user?.rol === 'administrador') {
      loadProb();
      loadCompra();
      loadPres();
    }
  }, [user?.rol, loadProb, loadCompra, loadPres]);

  const guardarProbabilidad = async () => {
    const n = parseFloat(porcentaje);
    if (isNaN(n) || n < 0 || n > 100) {
      Alert.alert('Error', 'El porcentaje debe estar entre 0 y 100');
      return;
    }
    setLoadingProb(true);
    try {
      await api.putConfigProbabilidad(n);
      Alert.alert('Guardado', 'Probabilidad actualizada.');
      loadProb();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (e instanceof Error ? e.message : 'Error');
      Alert.alert('Error', msg);
    } finally {
      setLoadingProb(false);
    }
  };

  const guardarCompraMinima = async () => {
    const n = parseFloat(compraMinima);
    if (isNaN(n) || n < 0) {
      Alert.alert('Error', 'La compra mínima debe ser un número ≥ 0');
      return;
    }
    setLoadingCompra(true);
    try {
      await api.putConfigCompraMinima(n);
      Alert.alert('Guardado', 'Compra mínima actualizada.');
      loadCompra();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (e instanceof Error ? e.message : 'Error');
      Alert.alert('Error', msg);
    } finally {
      setLoadingCompra(false);
    }
  };

  const guardarPresentaciones = async () => {
    setLoadingPres(true);
    try {
      await api.putConfigPresentacionesParticipar(presentaciones);
      Alert.alert('Guardado', 'Presentaciones que pueden participar actualizadas.');
      loadPres();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (e instanceof Error ? e.message : 'Error');
      Alert.alert('Error', msg);
    } finally {
      setLoadingPres(false);
    }
  };

  const togglePresentacion = (nombre: string) => {
    setPresentaciones((prev) =>
      prev.includes(nombre) ? prev.filter((p) => p !== nombre) : [...prev, nombre]
    );
  };

  const seleccionarTodas = () => setPresentaciones([...presentacionesOpciones]);
  const quitarTodas = () => setPresentaciones([]);

  if (user?.rol !== 'administrador') {
    return (
      <View style={styles.container}>
        <Text style={styles.noAccess}>Sin permiso.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Probabilidad de ganar */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Probabilidad de ganar</Text>
        <Text style={styles.hint}>Porcentaje (0–100). Ej: 10 = 10% de probabilidad de ganar.</Text>
        <TextInput
          style={styles.input}
          value={porcentaje}
          onChangeText={setPorcentaje}
          placeholder="Ej: 10"
          keyboardType="numeric"
        />
        {probabilidad != null && (
          <Text style={styles.current}>Actual: {probabilidad} ({(probabilidad * 100).toFixed(0)}%)</Text>
        )}
        <TouchableOpacity style={styles.btn} onPress={guardarProbabilidad} disabled={loadingProb}>
          {loadingProb ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Guardar</Text>}
        </TouchableOpacity>
      </View>

      {/* Compra mínima para usar bono */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Compra mínima para usar el bono (pesos)</Text>
        <TextInput
          style={styles.input}
          value={compraMinima}
          onChangeText={setCompraMinima}
          placeholder="Ej: 100000"
          keyboardType="numeric"
        />
        {compraMinimaVal != null && (
          <Text style={styles.current}>Actual: ${compraMinimaVal.toLocaleString('es-CO')}</Text>
        )}
        <TouchableOpacity style={styles.btn} onPress={guardarCompraMinima} disabled={loadingCompra}>
          {loadingCompra ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Guardar</Text>}
        </TouchableOpacity>
      </View>

      {/* Presentaciones que pueden participar */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Presentaciones que pueden participar</Text>
        <Text style={styles.hint}>Si la lista está vacía, cualquier factura puede participar.</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.btnSmall]} onPress={seleccionarTodas}>
            <Text style={styles.btnText}>Seleccionar todas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnSmall, styles.btnSecondary]} onPress={quitarTodas}>
            <Text style={styles.btnText}>Quitar todas</Text>
          </TouchableOpacity>
        </View>
        {presentacionesOpciones.map((nombre) => (
          <View key={nombre} style={styles.checkRow}>
            <Switch
              value={presentaciones.includes(nombre)}
              onValueChange={() => togglePresentacion(nombre)}
              trackColor={{ false: '#cbd5e1', true: '#1e3a5f' }}
              thumbColor="#fff"
            />
            <Text style={styles.checkLabel}>{nombre}</Text>
          </View>
        ))}
        <TouchableOpacity style={styles.btn} onPress={guardarPresentaciones} disabled={loadingPres}>
          {loadingPres ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Guardar</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  block: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  blockTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  current: { fontSize: 13, color: '#475569', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 12 },
  btn: { backgroundColor: '#1e3a5f', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnSmall: { flex: 1, marginRight: 8 },
  btnSecondary: { backgroundColor: '#475569' },
  btnText: { color: '#fff', fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkLabel: { marginLeft: 12, fontSize: 14 },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
