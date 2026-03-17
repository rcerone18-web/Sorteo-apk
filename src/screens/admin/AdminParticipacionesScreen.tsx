import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../api/client';
import { toCsvRow, shareCsv } from '../../utils/csvExport';
import type { ParticipacionItem } from '../../types';

function formatDate(s: string) {
  if (!s) return '';
  return s.slice(0, 10);
}

export default function AdminParticipacionesScreen() {
  const { user } = useAuth();
  const [list, setList] = useState<ParticipacionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cliente, setCliente] = useState('');
  const [factura, setFactura] = useState('');
  const [estado, setEstado] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: api.ParticipacionesQuery = {};
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      if (cliente.trim()) params.cliente = cliente.trim();
      if (factura.trim()) params.factura = factura.trim();
      if (estado && estado !== 'todos') params.estado = estado as 'disponible' | 'redimido' | 'vencido';
      const data = await api.getParticipacionesList(params);
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
    const headers = ['facturaNumero', 'fechaFactura', 'cedula', 'nombreCliente', 'valorTotal', 'fechaRegistro', 'usuarioRegistro'];
    const rows = [headers.join(',')];
    list.forEach((p) => {
      rows.push(toCsvRow([
        p.facturaNumero,
        formatDate(p.fechaFactura),
        p.cedula,
        p.nombreCliente,
        p.valorTotal,
        formatDate(p.fechaRegistro),
        p.usuarioRegistro,
      ]));
    });
    await shareCsv(rows.join('\n'), 'participaciones.csv');
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
        <Text style={styles.label}>Desde</Text>
        <TextInput style={styles.input} value={desde} onChangeText={setDesde} placeholder="YYYY-MM-DD" />
        <Text style={styles.label}>Hasta</Text>
        <TextInput style={styles.input} value={hasta} onChangeText={setHasta} placeholder="YYYY-MM-DD" />
        <Text style={styles.label}>Cliente / Cédula</Text>
        <TextInput style={styles.input} value={cliente} onChangeText={setCliente} placeholder="Buscar..." />
        <Text style={styles.label}>Nº factura</Text>
        <TextInput style={styles.input} value={factura} onChangeText={setFactura} placeholder="Buscar..." />
        <Text style={styles.label}>Estado bono</Text>
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
        <View style={styles.rowButtons}>
          <TouchableOpacity style={[styles.btn, styles.btnFlex]} onPress={load} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Filtrar</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary, styles.btnFlex]} onPress={exportarCsv} disabled={list.length === 0}>
            <Text style={styles.btnText}>Exportar CSV</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Sin resultados</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.rowCard}>
            <Text style={styles.cellFactura}>{item.facturaNumero}</Text>
            <Text style={styles.cell}>{formatDate(item.fechaFactura)}</Text>
            <Text style={styles.cell} numberOfLines={1}>{item.nombreCliente}</Text>
            <Text style={styles.cell}>{item.cedula}</Text>
            <Text style={styles.cell}>${Number(item.valorTotal).toLocaleString('es-CO')}</Text>
            <Text style={styles.cellSmall}>{formatDate(item.fechaRegistro)}</Text>
          </View>
        )}
        style={styles.list}
        ListHeaderComponent={
          list.length > 0 ? (
            <View style={styles.headerRow}>
              <Text style={styles.headerCell}>Factura</Text>
              <Text style={styles.headerCell}>Fcha fact.</Text>
              <Text style={styles.headerCell}>Cliente</Text>
              <Text style={styles.headerCell}>Cédula</Text>
              <Text style={styles.headerCell}>Valor</Text>
              <Text style={styles.headerCellSmall}>Fcha reg.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  filters: { maxHeight: 280, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  filtersContent: { padding: 12 },
  label: { fontSize: 12, color: '#64748b', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  rowButtons: { flexDirection: 'row', marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#e2e8f0', marginRight: 8, marginBottom: 4 },
  chipActive: { backgroundColor: '#1e3a5f' },
  chipText: { fontSize: 13, color: '#475569' },
  chipTextActive: { color: '#fff' },
  btn: { backgroundColor: '#1e3a5f', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  btnFlex: { flex: 1 },
  btnSecondary: { backgroundColor: '#475569', marginLeft: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  list: { flex: 1 },
  headerRow: { flexDirection: 'row', padding: 10, backgroundColor: '#1e3a5f' },
  headerCell: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 12 },
  headerCellSmall: { width: 72, color: '#fff', fontWeight: '600', fontSize: 11 },
  rowCard: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  cellFactura: { flex: 1, fontSize: 12 },
  cell: { flex: 1, fontSize: 12 },
  cellSmall: { width: 72, fontSize: 11, color: '#64748b' },
  empty: { padding: 24, textAlign: 'center', color: '#64748b' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
