import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../api/client';
import type { BonoItem } from '../../types';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { errorToAlertMessage } from '../../utils/errors';

export default function AdminRedencionScreen() {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const [bonos, setBonos] = useState<BonoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [redimiendoId, setRedimiendoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBonos({ estado: 'disponible' });
      setBonos(data);
    } catch (e) {
      const raw = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      const msg = errorToAlertMessage(raw, e instanceof Error ? e.message : 'Error al cargar');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.rol === 'administrador') load();
  }, [user?.rol, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const redimir = async (bono: BonoItem) => {
    Alert.alert(
      'Redimir bono',
      `¿Redimir bono ${bono.codigo} ($${Number(bono.valor).toLocaleString('es-CO')}) para ${bono.nombreCliente}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Redimir',
          onPress: async () => {
            setRedimiendoId(bono.id);
            try {
              await api.redimirBono(bono.id);
              Alert.alert('Éxito', 'Bono redimido correctamente.');
              load();
            } catch (e) {
              const raw = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
              const msg = errorToAlertMessage(raw, e instanceof Error ? e.message : 'No se pudo redimir');
              Alert.alert('Error', msg);
            } finally {
              setRedimiendoId(null);
            }
          },
        },
      ]
    );
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
      <Card style={styles.hintCard}>
        <Text style={[styles.hintText, { color: theme.colors.mutedText }]}>
          Solo bonos con estado "disponible". Al redimir, el bono pasará a "redimido".
        </Text>
      </Card>
      <FlatList
        data={bonos}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No hay bonos disponibles para redimir.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View>
              <Text style={[styles.codigo, { color: theme.colors.text }]}>{item.codigo}</Text>
              <Text style={[styles.cliente, { color: theme.colors.mutedText }]}>{item.nombreCliente}</Text>
              <Text style={[styles.detalle, { color: theme.colors.mutedText }]}>
                Factura: {item.facturaOrigen} — ${Number(item.valor).toLocaleString('es-CO')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btnRedimir, redimiendoId === item.id && styles.btnDisabled]}
              onPress={() => redimir(item)}
              disabled={redimiendoId !== null}
            >
              {redimiendoId === item.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>Redimir</Text>
              )}
            </TouchableOpacity>
          </Card>
        )}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hintCard: { marginHorizontal: 16, marginTop: 16 },
  hintText: { fontSize: 13, fontWeight: '700' },
  list: { flex: 1, paddingHorizontal: 0 },
  itemCard: { marginHorizontal: 16, marginVertical: 8, padding: 16 },
  codigo: { fontSize: 16, fontWeight: '900' },
  cliente: { fontSize: 14, marginTop: 4 },
  detalle: { fontSize: 12, marginTop: 6, lineHeight: 16 },
  btnRedimir: { backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontWeight: '600' },
  empty: { padding: 24, textAlign: 'center', color: '#64748b' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
