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

export default function AdminConfigScreen() {
  const { user } = useAuth();
  const { mode, toggleTheme, theme } = useAppTheme();
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

      {/* Probabilidad de ganar */}
      <Card style={styles.block}>
        <Text style={[styles.blockTitle, { color: theme.colors.text }]}>Probabilidad de ganar</Text>
        <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
          Porcentaje (0–100). Ej: 10 = 10% de probabilidad de ganar.
        </Text>
        <Input value={porcentaje} onChangeText={setPorcentaje} placeholder="Ej: 10" keyboardType="numeric" />
        {probabilidad != null && (
          <Text style={[styles.current, { color: theme.colors.text }]}>
            Actual: {probabilidad} ({(probabilidad * 100).toFixed(0)}%)
          </Text>
        )}
        <View style={styles.ctaRow}>
          <Button title="Guardar" onPress={guardarProbabilidad} loading={loadingProb} disabled={loadingProb} variant="primary" />
        </View>
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
