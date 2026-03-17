import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../api/client';
import { toCsvRow, shareCsv } from '../../utils/csvExport';
import type { BonoItem } from '../../types';

function formatDate(s: string) {
  if (!s) return '';
  return s.slice(0, 10);
}

export default function AdminBonosScreen() {
  const { user } = useAuth();
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
    <View style={styles.container}>
      <ScrollView style={styles.filters} contentContainerStyle={styles.filtersContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Desde / Hasta</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.flex1]} value={desde} onChangeText={setDesde} placeholder="Desde" />
          <TextInput style={[styles.input, styles.flex1]} value={hasta} onChangeText={setHasta} placeholder="Hasta" />
        </View>
        <Text style={styles.label}>Cliente / Factura</Text>
        <TextInput style={styles.input} value={cliente} onChangeText={setCliente} placeholder="Cliente o cédula" />
        <TextInput style={styles.input} value={factura} onChangeText={setFactura} placeholder="Nº factura" />
        <Text style={styles.label}>Estado</Text>
        <View style={styles.row}>
          {['', 'disponible', 'redimido', 'vencido'].map((e) => (
            <TouchableOpacity
              key={e || 'todos'}
              style={[styles.chip, estado === e ? styles.chipActive : null]}
              onPress={() => setEstado(e)}
            >
              <Text style={[styles.chipText, estado === e ? styles.chipTextActive : null]}>{e || 'Todos'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={load} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Filtrar</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={exportarCsv} disabled={list.length === 0}>
            <Text style={styles.btnText}>Exportar CSV</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Sin resultados</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.rowCard}>
            <Text style={styles.cellCode}>{item.codigo}</Text>
            <Text style={styles.cell}>{item.facturaOrigen}</Text>
            <Text style={styles.cell} numberOfLines={1}>{item.nombreCliente}</Text>
            <Text style={styles.cell}>${Number(item.valor).toLocaleString('es-CO')}</Text>
            <Text style={styles.cellSmall}>{formatDate(item.fechaEmision)}</Text>
            <Text style={styles.cellSmall}>{formatDate(item.fechaVencimiento)}</Text>
            <Text style={[styles.cellEstado, item.estadoMostrar === 'vencido' || item.estado === 'vencido' ? styles.vencido : item.estado === 'redimido' ? styles.redimido : styles.disponible]}>
              {item.estadoMostrar || item.estado}
            </Text>
          </View>
        )}
        style={styles.list}
        ListHeaderComponent={
          list.length > 0 ? (
            <View style={styles.headerRow}>
              <Text style={styles.headerCell}>Código</Text>
              <Text style={styles.headerCell}>Factura</Text>
              <Text style={styles.headerCell}>Cliente</Text>
              <Text style={styles.headerCell}>Valor</Text>
              <Text style={styles.headerCellSmall}>Emisión</Text>
              <Text style={styles.headerCellSmall}>Venc.</Text>
              <Text style={styles.headerCellSmall}>Estado</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  filters: { maxHeight: 320, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  filtersContent: { padding: 12 },
  label: { fontSize: 12, color: '#64748b', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, fontSize: 14 },
  flex1: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#e2e8f0', marginRight: 8, marginBottom: 4 },
  chipActive: { backgroundColor: '#1e3a5f' },
  chipText: { fontSize: 13, color: '#475569' },
  chipTextActive: { color: '#fff' },
  btn: { flex: 1, backgroundColor: '#1e3a5f', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginTop: 8, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#475569', marginLeft: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  list: { flex: 1 },
  headerRow: { flexDirection: 'row', padding: 10, backgroundColor: '#1e3a5f' },
  headerCell: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 11 },
  headerCellSmall: { width: 70, color: '#fff', fontWeight: '600', fontSize: 10 },
  rowCard: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  cellCode: { flex: 1, fontSize: 11 },
  cell: { flex: 1, fontSize: 11 },
  cellSmall: { width: 70, fontSize: 10, color: '#64748b' },
  cellEstado: { width: 72, fontSize: 10, fontWeight: '600' },
  disponible: { color: '#16a34a' },
  redimido: { color: '#64748b' },
  vencido: { color: '#dc2626' },
  empty: { padding: 24, textAlign: 'center', color: '#64748b' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
