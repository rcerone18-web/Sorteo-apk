import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../api/client';
import { toCsvRow, shareCsv } from '../../utils/csvExport';
import type { BonoItem } from '../../types';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

function formatDate(s: string) {
  if (!s) return '';
  return s.slice(0, 10);
}

export default function AdminBonosScreen() {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const [list, setList] = useState<BonoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [estado, setEstado] = useState<string>('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cliente, setCliente] = useState('');
  const [factura, setFactura] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: api.BonosQuery = {};
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      if (cliente.trim()) params.cliente = cliente.trim();
      if (factura.trim()) params.factura = factura.trim();
      if (estado && estado !== 'todos') params.estado = estado;
      const data = await api.getBonos(params);
      setList(data);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (e instanceof Error ? e.message : 'Error al cargar');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [desde, hasta, cliente, factura, estado]);

  useEffect(() => {
    if (user?.rol === 'administrador') load();
  }, [user?.rol, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const exportarCsv = async () => {
    const headers = ['id', 'facturaOrigen', 'cedula', 'nombreCliente', 'valor', 'fechaEmision', 'fechaVencimiento', 'estado'];
    const rows = [headers.join(',')];
    list.forEach((b) => {
      const est = b.estadoMostrar || b.estado;
      rows.push(toCsvRow([
        b.id,
        b.facturaOrigen,
        b.cedula,
        b.nombreCliente,
        b.valor,
        formatDate(b.fechaEmision),
        formatDate(b.fechaVencimiento),
        est,
      ]));
    });
    await shareCsv(rows.join('\n'), 'bonos.csv');
  };

  if (user?.rol !== 'administrador') {
    return (
      <View style={styles.container}>
        <Text style={styles.noAccess}>Sin permiso.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.filters}>
        <ScrollView contentContainerStyle={styles.filtersContent} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: theme.colors.mutedText }]}>Desde / Hasta</Text>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Input placeholder="Desde" value={desde} onChangeText={setDesde} />
            </View>
            <View style={styles.flex1}>
              <Input placeholder="Hasta" value={hasta} onChangeText={setHasta} />
            </View>
          </View>

          <Text style={[styles.label, { color: theme.colors.mutedText }]}>Cliente / Factura</Text>
          <Input placeholder="Cliente o cédula" value={cliente} onChangeText={setCliente} />
          <View style={{ height: 10 }} />
          <Input placeholder="Nº factura" value={factura} onChangeText={setFactura} />

          <Text style={[styles.label, { color: theme.colors.mutedText, marginTop: 10 }]}>Estado</Text>
          <View style={styles.row}>
            {['', 'disponible', 'redimido', 'vencido'].map((e) => (
              <TouchableOpacity
                key={e || 'todos'}
                style={[
                  styles.chip,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  estado === e && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
                onPress={() => setEstado(e)}
              >
                <Text style={[styles.chipText, estado === e && { color: '#fff' }]}>{e || 'Todos'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Button title="Filtrar" onPress={load} disabled={loading} loading={loading} variant="primary" />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Button
                title="Exportar CSV"
                onPress={exportarCsv}
                disabled={list.length === 0}
                variant="secondary"
              />
            </View>
          </View>
        </ScrollView>
      </Card>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Sin resultados</Text> : null}
        renderItem={({ item }) => (
          <Card style={styles.rowCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[styles.codigo, { color: theme.colors.text }]} numberOfLines={1}>
                {item.codigo}
              </Text>
              <View style={styles.estadoBadge}>
                <Text style={[styles.estadoBadgeText, item.estadoMostrar === 'vencido' || item.estado === 'vencido' ? { color: '#dc2626' } : item.estado === 'redimido' ? { color: '#64748b' } : { color: '#16a34a' }]}>
                  {item.estadoMostrar || item.estado}
                </Text>
              </View>
            </View>
            <Text style={[styles.cliente, { color: theme.colors.mutedText }]} numberOfLines={1}>
              {item.nombreCliente}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.metaText, { color: theme.colors.text, fontWeight: '900' }]}>
                ${Number(item.valor).toLocaleString('es-CO')}
              </Text>
              <Text style={[styles.metaText, { color: theme.colors.mutedText }]}>{item.facturaOrigen}</Text>
            </View>
            <Text style={[styles.metaText, { color: theme.colors.mutedText }]}>
              Emisión: {formatDate(item.fechaEmision)} • Venc.: {formatDate(item.fechaVencimiento)}
            </Text>
          </Card>
        )}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: { margin: 16, padding: 14 },
  filtersContent: { padding: 0 },
  label: { fontSize: 12, marginTop: 6, fontWeight: '800' },
  flex1: { flex: 1, marginRight: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
  },
  chipText: { fontSize: 13, fontWeight: '800' },
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  rowCard: { padding: 16, marginBottom: 12 },
  codigo: { flex: 1, fontSize: 12, fontWeight: '900' },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.03)' },
  estadoBadgeText: { fontSize: 12, fontWeight: '900' },
  cliente: { fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 4 },
  metaText: { fontSize: 13, flex: 1 },
  empty: { padding: 24, textAlign: 'center', color: '#64748b' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
