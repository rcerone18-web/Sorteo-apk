import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../api/client';
import type { SorteoItem, ParticipacionItem } from '../../types';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { errorToAlertMessage } from '../../utils/errors';

function formatDate(s: string) {
  if (!s) return '';
  return s.slice(0, 10);
}

type SorteoConParticipacion = SorteoItem & { nombreCliente?: string; facturaNumero?: string };

export default function AdminSorteosScreen() {
  const { user } = useAuth();
  const { theme } = useAppTheme();
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
      const raw = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      const msg = errorToAlertMessage(raw, e instanceof Error ? e.message : 'Error al cargar');
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.filtersCard}>
        <View style={styles.filters}>
          <Input placeholder="Desde (YYYY-MM-DD)" value={desde} onChangeText={setDesde} />
          <Input placeholder="Hasta (YYYY-MM-DD)" value={hasta} onChangeText={setHasta} />
          <View style={{ marginTop: 12 }}>
            <Button title="Filtrar" onPress={load} disabled={loading} loading={loading} variant="primary" />
          </View>
        </View>
      </Card>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Sin resultados</Text> : null}
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <Text style={[styles.itemDate, { color: theme.colors.text }]}>
              {formatDate(item.fechaSorteo)}
            </Text>
            <Text style={[styles.itemClient, { color: theme.colors.text }]} numberOfLines={1}>
              Cliente: {item.nombreCliente ?? '-'}
            </Text>
            <Text style={[styles.itemClient, { color: theme.colors.mutedText }]} numberOfLines={1}>
              Factura: {item.facturaNumero ?? '-'}
            </Text>

            <View
              style={[
                styles.resultBadge,
                {
                  backgroundColor: item.ganador ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                },
              ]}
            >
              <Text style={[styles.resultBadgeText, { color: item.ganador ? '#16a34a' : theme.colors.mutedText }]}>
                {item.ganador ? 'Ganador' : 'No ganó'}
              </Text>
            </View>
          </Card>
        )}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filtersCard: { margin: 16 },
  filters: { padding: 2 },
  list: { flex: 1, paddingHorizontal: 0 },
  itemCard: { marginHorizontal: 16, marginVertical: 8 },
  itemDate: { fontSize: 13, fontWeight: '900' },
  itemClient: { fontSize: 13, fontWeight: '800', marginTop: 6 },
  resultBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  resultBadgeText: { fontSize: 12, fontWeight: '900' },
  empty: { padding: 24, textAlign: 'center', color: '#64748b' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
