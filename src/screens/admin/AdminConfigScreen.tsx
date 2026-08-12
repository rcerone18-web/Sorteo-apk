import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../api/client';
import { PRESENTACIONES } from '../../constants/presentaciones';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { errorToAlertMessage } from '../../utils/errors';

export default function AdminConfigScreen() {
  const { user } = useAuth();
  const { mode, toggleTheme, theme } = useAppTheme();
  const [loadingCompra, setLoadingCompra] = useState(false);
  const [loadingMinRefs, setLoadingMinRefs] = useState(false);
  const [loadingPres, setLoadingPres] = useState(false);
  const [compraMinima, setCompraMinima] = useState('');
  const [compraMinimaVal, setCompraMinimaVal] = useState<number | null>(null);
  const [minSubtotalRefs, setMinSubtotalRefs] = useState('');
  const [minSubtotalRefsVal, setMinSubtotalRefsVal] = useState<number | null>(null);
  const [presentaciones, setPresentaciones] = useState<string[]>([]);
  const [presentacionesOpciones] = useState(() => PRESENTACIONES.map((p) => p.nombre));

  const loadCompra = useCallback(async () => {
    try {
      const r = await api.getConfigCompraMinima();
      setCompraMinimaVal(r.compraMinima);
      setCompraMinima(String(r.compraMinima));
    } catch (e) {
      Alert.alert('Error', errorToAlertMessage((e as any)?.response?.data?.error, (e as Error).message || 'No se pudo cargar compra mínima'));
    }
  }, []);

  const loadPres = useCallback(async () => {
    try {
      const r = await api.getConfigPresentacionesParticipar();
      setPresentaciones(r.presentaciones || []);
    } catch (e) {
      Alert.alert('Error', errorToAlertMessage((e as any)?.response?.data?.error, (e as Error).message || 'No se pudo cargar presentaciones'));
    }
  }, []);

  const loadMinRefs = useCallback(async () => {
    try {
      const r = await api.getConfigMinSubtotalRefsParticipar();
      setMinSubtotalRefsVal(r.minSubtotal);
      setMinSubtotalRefs(String(r.minSubtotal));
    } catch (e) {
      Alert.alert('Error', errorToAlertMessage((e as any)?.response?.data?.error, (e as Error).message || 'No se pudo cargar el minimo por referencias'));
    }
  }, []);

  useEffect(() => {
    if (user?.rol === 'administrador') {
      loadCompra();
      loadMinRefs();
      loadPres();
    }
  }, [user?.rol, loadCompra, loadMinRefs, loadPres]);

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
      const raw = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      Alert.alert('Error', errorToAlertMessage(raw, e instanceof Error ? e.message : 'Error'));
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
      const raw = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      Alert.alert('Error', errorToAlertMessage(raw, e instanceof Error ? e.message : 'Error'));
    } finally {
      setLoadingPres(false);
    }
  };

  const guardarMinRefs = async () => {
    const n = parseFloat(minSubtotalRefs);
    if (isNaN(n) || n < 0) {
      Alert.alert('Error', 'El minimo debe ser un numero >= 0');
      return;
    }
    setLoadingMinRefs(true);
    try {
      await api.putConfigMinSubtotalRefsParticipar(n);
      Alert.alert('Guardado', 'Minimo por referencias actualizado.');
      loadMinRefs();
    } catch (e) {
      const raw = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      Alert.alert('Error', errorToAlertMessage(raw, e instanceof Error ? e.message : 'Error'));
    } finally {
      setLoadingMinRefs(false);
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
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.noAccess, { color: theme.colors.mutedText }]}>Sin permiso.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Tema */}
      <Card style={styles.block}>
        <View style={styles.themeRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.blockTitle, { marginBottom: 4 }]}>Tema oscuro</Text>
            <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
              Usa el modo oscuro para una experiencia más cómoda.
            </Text>
          </View>
          <Switch
            value={mode === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={mode === 'dark' ? '#fff' : '#fff'}
          />
        </View>
      </Card>

      <Card style={styles.block}>
        <Text style={[styles.blockTitle, { color: theme.colors.text }]}>Probabilidad del sorteo</Text>
        <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
          Con campaña activa en el servidor, la probabilidad base y el ajuste automático por costos se definen en la campaña (no desde esta app). Solo en escenarios sin campaña o heredados interviene la configuración antigua del servidor; el sorteo offline usa la última configuración descargada.
        </Text>
      </Card>

      {/* Compra mínima para usar bono */}
      <Card style={styles.block}>
        <Text style={[styles.blockTitle, { color: theme.colors.text }]}>Compra mínima para usar el bono (pesos)</Text>
        <Input value={compraMinima} onChangeText={setCompraMinima} placeholder="Ej: 100000" keyboardType="numeric" />
        {compraMinimaVal != null && (
          <Text style={[styles.current, { color: theme.colors.text }]}>
            Actual: ${compraMinimaVal.toLocaleString('es-CO')}
          </Text>
        )}
        <View style={styles.ctaRow}>
          <Button title="Guardar" onPress={guardarCompraMinima} loading={loadingCompra} disabled={loadingCompra} variant="primary" />
        </View>
      </Card>

      {/* Mínimo por referencias para participar */}
      <Card style={styles.block}>
        <Text style={[styles.blockTitle, { color: theme.colors.text }]}>Mínimo por referencias para participar (pesos)</Text>
        <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
          Aplica solo cuando hay presentaciones seleccionadas. Se calcula sobre el subtotal elegible de esas referencias.
        </Text>
        <Input value={minSubtotalRefs} onChangeText={setMinSubtotalRefs} placeholder="Ej: 0" keyboardType="numeric" />
        {minSubtotalRefsVal != null && (
          <Text style={[styles.current, { color: theme.colors.text }]}>
            Actual: ${minSubtotalRefsVal.toLocaleString('es-CO')}
          </Text>
        )}
        <View style={styles.ctaRow}>
          <Button title="Guardar" onPress={guardarMinRefs} loading={loadingMinRefs} disabled={loadingMinRefs} variant="primary" />
        </View>
      </Card>

      {/* Presentaciones que pueden participar */}
      <Card style={styles.block}>
        <Text style={[styles.blockTitle, { color: theme.colors.text }]}>Presentaciones que pueden participar</Text>
        <Text style={[styles.hint, { color: theme.colors.mutedText }]}>Si la lista está vacía, cualquier factura puede participar.</Text>
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Button title="Seleccionar todas" onPress={seleccionarTodas} variant="secondary" />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Button title="Quitar todas" onPress={quitarTodas} variant="secondary" />
          </View>
        </View>
        {presentacionesOpciones.map((nombre) => (
          <View key={nombre} style={styles.checkRow}>
            <Switch
              value={presentaciones.includes(nombre)}
              onValueChange={() => togglePresentacion(nombre)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#fff"
            />
            <Text style={[styles.checkLabel, { color: theme.colors.text }]}>{nombre}</Text>
          </View>
        ))}
        <View style={styles.ctaRow}>
          <Button title="Guardar" onPress={guardarPresentaciones} loading={loadingPres} disabled={loadingPres} variant="primary" />
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  block: {
    marginBottom: 20,
  },
  themeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockTitle: { fontSize: 16, fontWeight: '900', marginBottom: 8 },
  hint: { fontSize: 12, marginBottom: 8, fontWeight: '700' },
  current: { fontSize: 13, marginBottom: 8, fontWeight: '800' },
  row: { flexDirection: 'row', marginBottom: 12 },
  ctaRow: { marginTop: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkLabel: { marginLeft: 12, fontSize: 14, fontWeight: '800' },
  noAccess: { fontSize: 16, textAlign: 'center', marginTop: 40 },
});
