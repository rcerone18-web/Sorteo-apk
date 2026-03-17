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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../api/client';
import { toCsvRow, shareCsv } from '../../utils/csvExport';
import type { SorteoItem, ParticipacionItem } from '../../types';

function formatDate(s: string) {
  if (!s) return '';
  return s.slice(0, 10);
}

type GanadorRow = {
  id: string;
  nombreCliente: string;
  cedula: string;
  facturaNumero: string;
  valorFactura: number;
  valorBono: number;
  fechaSorteo: string;
};

export default function AdminGanadoresScreen() {
  const { user } = useAuth();
  const [list, setList] = useState<GanadorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sorteos, parts] = await Promise.all([
        api.getSorteos({ desde: desde || undefined, hasta: hasta || undefined }),
        api.getParticipacionesList({}),
      ]);
      const map: Record<string, ParticipacionItem> = {};
      parts.forEach((p) => { map[p.id] = p; });
      const ganadores = sorteos.filter((s) => s.ganador === 1);
      const rows: GanadorRow[] = ganadores.map((s) => {
        const p = map[s.participacionId];
        const valor = p?.valorTotal ?? 0;
        const bono = Math.round(valor * 0.5);
        return {
          id: s.id,
          nombreCliente: p?.nombreCliente ?? '',
          cedula: p?.cedula ?? '',
          facturaNumero: p?.facturaNumero ?? '',
          valorFactura: valor,
          valorBono: bono,
          fechaSorteo: s.fechaSorteo,
        };
      });
      setList(rows);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (e instanceof Error ? e.message : 'Error al cargar');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    if (user?.rol === 'administrador') load();
  }, [user?.rol, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const exportarCsv = async () => {
    const headers = ['facturaNumero', 'nombreCliente', 'cedula', 'valorFactura', 'fechaSorteo'];
    const rows = [headers.join(',')];
    list.forEach((g) => {
      rows.push(toCsvRow([g.facturaNumero, g.nombreCliente, g.cedula, g.valorFactura, formatDate(g.fechaSorteo)]));
    });
    await shareCsv(rows.join('\n'), 'ganadores.csv');
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
      <View style={styles.filters}>
        <TextInput style={styles.input} value={desde} onChangeText={setDesde} placeholder="Desde (YYYY-MM-DD)" />
        <TextInput style={styles.input} value={hasta} onChangeText={setHasta} placeholder="Hasta (YYYY-MM-DD)" />
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={load} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Filtrar</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={exportarCsv} disabled={list.length === 0}>
            <Text style={styles.btnText}>Exportar CSV</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Sin ganadores</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.rowCard}>
            <Text style={styles.cell} numberOfLines={1}>{item.nombreCliente}</Text>
            <Text style={styles.cellSmall}>{item.cedula}</Text>
            <Text style={styles.cell}>{item.facturaNumero}</Text>
            <Text style={styles.cell}>${Number(item.valorFactura).toLocaleString('es-CO')}</Text>
            <Text style={styles.cell}>${Number(item.valorBono).toLocaleString('es-CO')}</Text>
            <Text style={styles.cellSmall}>{formatDate(item.fechaSorteo)}</Text>
          </View>
        )}
        style={styles.list}
        ListHeaderComponent={
          list.length > 0 ? (
            <View style={styles.headerRow}>
              <Text style={styles.headerCell}>Cliente</Text>
              <Text style={styles.headerCellSmall}>Cédula</Text>
              <Text style={styles.headerCell}>Factura</Text>
              <Text style={styles.headerCell}>Valor fact.</Text>
              <Text style={styles.headerCell}>Bono 50%</Text>
              <Text style={styles.headerCellSmall}>Fecha</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  filters: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, fontSize: 14, marginBottom: 8 },
  row: { flexDirection: 'row' },
  btn: { flex: 1, backgroundColor: '#1e3a5f', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginRight: 8 },
  btnSecondary: { backgroundColor: '#475569', marginRight: 0 },
  btnText: { color: '#fff', fontWeight: '600' },
  list: { flex: 1 },
  headerRow: { flexDirection: 'row', padding: 10, backgroundColor: '#1e3a5f' },
  headerCell: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 12 },
  headerCellSmall: { width: 72, color: '#fff', fontWeight: '600', fontSize: 11 },
  rowCard: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  cell: { flex: 1, fontSize: 12 },
  cellSmall: { width: 72, fontSize: 11 },
  empty: { padding: 24, textAlign: 'center', color: '#64748b' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
