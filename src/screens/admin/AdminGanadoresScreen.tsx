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
import { toCsvRow, shareCsv } from '../../utils/csvExport';
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
  const { theme } = useAppTheme();
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.filters}>
        <Text style={[styles.filtersTitle, { color: theme.colors.text }]}>Filtros</Text>
        <View style={styles.filterRow}>
          <Input placeholder="Desde (YYYY-MM-DD)" value={desde} onChangeText={setDesde} />
          <Input placeholder="Hasta (YYYY-MM-DD)" value={hasta} onChangeText={setHasta} />
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
      </Card>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Sin ganadores</Text> : null}
        renderItem={({ item }) => (
          <Card style={styles.rowCard}>
            <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {item.nombreCliente}
            </Text>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemMetaText, { color: theme.colors.mutedText }]}>Cédula: {item.cedula}</Text>
              <Text style={[styles.itemMetaText, { color: theme.colors.mutedText }]}>Factura: {item.facturaNumero}</Text>
            </View>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemMetaText, { color: theme.colors.text, fontWeight: '900' }]}>
                Valor fact.: ${Number(item.valorFactura).toLocaleString('es-CO')}
              </Text>
              <Text style={[styles.itemMetaText, { color: theme.colors.accent, fontWeight: '900' }]}>
                Bono 50%: ${Number(item.valorBono).toLocaleString('es-CO')}
              </Text>
            </View>
            <Text style={[styles.itemFooter, { color: theme.colors.mutedText }]}>Fecha: {formatDate(item.fechaSorteo)}</Text>
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
  filtersTitle: { fontSize: 18, fontWeight: '900', marginBottom: 10 },
  filterRow: { flexDirection: 'row' },
  row: { flexDirection: 'row' },
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 6 },
  rowCard: { padding: 16, marginBottom: 12 },
  itemTitle: { fontSize: 16, fontWeight: '900', marginBottom: 8 },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 12 } as any,
  itemMetaText: { flex: 1, fontSize: 13 },
  itemFooter: { fontSize: 12, fontWeight: '800', marginTop: 6 },
  empty: { padding: 24, textAlign: 'center' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
