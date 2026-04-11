import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../api/client';
import { toCsvRow, shareCsv } from '../../utils/csvExport';
import type { ParticipacionItem } from '../../types';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

function formatDate(s: string) {
  if (!s) return '';
  return s.slice(0, 10);
}

export default function AdminParticipacionesScreen() {
  const { user } = useAuth();
  const { theme } = useAppTheme();
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.filtersCard}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filtersContent}>
          <Text style={[styles.label, { color: theme.colors.mutedText }]}>Desde</Text>
          <Input placeholder="YYYY-MM-DD" value={desde} onChangeText={setDesde} />

          <Text style={[styles.label, { color: theme.colors.mutedText }]}>Hasta</Text>
          <Input placeholder="YYYY-MM-DD" value={hasta} onChangeText={setHasta} />

          <Text style={[styles.label, { color: theme.colors.mutedText }]}>Cliente / Cédula</Text>
          <Input placeholder="Buscar..." value={cliente} onChangeText={setCliente} />

          <Text style={[styles.label, { color: theme.colors.mutedText }]}>Nº factura</Text>
          <Input placeholder="Buscar..." value={factura} onChangeText={setFactura} />

          <Text style={[styles.label, { color: theme.colors.mutedText }]}>Estado bono</Text>
          <View style={styles.row}>
            {['', 'disponible', 'redimido', 'vencido'].map((e) => {
              const active = estado === e;
              return (
                <TouchableOpacity
                  key={e || 'todos'}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.colors.primary : theme.colors.card,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={() => setEstado(e)}
                >
                  <Text style={[styles.chipText, { color: active ? '#FFFFFF' : theme.colors.mutedText }]}>
                    {e || 'Todos'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.rowButtons}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Button
                title="Filtrar"
                onPress={load}
                disabled={loading}
                loading={loading}
                variant="primary"
              />
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
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Sin resultados</Text> : null
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
              Factura: {item.facturaNumero}
            </Text>
            <Text style={[styles.itemSub, { color: theme.colors.mutedText }]}>
              Fecha: {formatDate(item.fechaFactura)} • Registro: {formatDate(item.fechaRegistro)}
            </Text>
            <Text style={[styles.itemClient, { color: theme.colors.text }]} numberOfLines={1}>
              {item.nombreCliente}
            </Text>
            <Text style={[styles.itemMeta, { color: theme.colors.mutedText }]}>
              Cédula: {item.cedula} • Valor: ${Number(item.valorTotal).toLocaleString('es-CO')}
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
  filtersCard: { margin: 16 },
  filtersContent: { paddingBottom: 6 },
  label: { fontSize: 12, fontWeight: '900', marginTop: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 } as any,
  rowButtons: { flexDirection: 'row', marginTop: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 4,
  },
  chipText: { fontSize: 13, fontWeight: '900' },
  list: { flex: 1 },
  itemCard: { marginHorizontal: 16, marginVertical: 8, padding: 16 },
  itemTitle: { fontSize: 14, fontWeight: '900', marginBottom: 6 },
  itemSub: { fontSize: 12, fontWeight: '800' },
  itemClient: { fontSize: 13, fontWeight: '900', marginTop: 6 },
  itemMeta: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  empty: { padding: 24, textAlign: 'center', color: '#64748b' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
