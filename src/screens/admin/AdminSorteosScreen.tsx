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
import type { SorteoItem, ParticipacionItem } from '../../types';

function formatDate(s: string) {
  if (!s) return '';
  return s.slice(0, 10);
}

type SorteoConParticipacion = SorteoItem & { nombreCliente?: string; facturaNumero?: string };

export default function AdminSorteosScreen() {
  const { user } = useAuth();
  const [list, setList] = useState<SorteoConParticipacion[]>([]);
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
      const merged: SorteoConParticipacion[] = sorteos.map((s) => {
        const p = map[s.participacionId];
        return {
          ...s,
          nombreCliente: p?.nombreCliente ?? '',
          facturaNumero: p?.facturaNumero ?? '',
        };
      });
      setList(merged);
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
        <TouchableOpacity style={styles.btn} onPress={load} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Filtrar</Text>}
        </TouchableOpacity>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Sin resultados</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.rowCard}>
            <Text style={styles.cell}>{formatDate(item.fechaSorteo)}</Text>
            <Text style={styles.cell} numberOfLines={1}>{item.nombreCliente ?? '-'}</Text>
            <Text style={styles.cell}>{item.facturaNumero ?? '-'}</Text>
            <Text style={[styles.cell, item.ganador ? styles.ganador : styles.noGanador]}>
              {item.ganador ? 'Ganador' : 'No ganó'}
            </Text>
          </View>
        )}
        style={styles.list}
        ListHeaderComponent={
          list.length > 0 ? (
            <View style={styles.headerRow}>
              <Text style={styles.headerCell}>Fecha sorteo</Text>
              <Text style={styles.headerCell}>Cliente</Text>
              <Text style={styles.headerCell}>Factura</Text>
              <Text style={styles.headerCell}>Resultado</Text>
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
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, fontSize: 14 },
  btn: { backgroundColor: '#1e3a5f', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  list: { flex: 1 },
  headerRow: { flexDirection: 'row', padding: 10, backgroundColor: '#1e3a5f' },
  headerCell: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 12 },
  rowCard: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  cell: { flex: 1, fontSize: 12 },
  ganador: { color: '#16a34a', fontWeight: '600' },
  noGanador: { color: '#64748b' },
  empty: { padding: 24, textAlign: 'center', color: '#64748b' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
