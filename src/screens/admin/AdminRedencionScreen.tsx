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

export default function AdminRedencionScreen() {
  const { user } = useAuth();
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
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (e instanceof Error ? e.message : 'Error al cargar');
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
              const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
                || (e instanceof Error ? e.message : 'No se pudo redimir');
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
    <View style={styles.container}>
      <Text style={styles.hint}>Solo bonos con estado "disponible". Al redimir, el bono pasará a "redimido".</Text>
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
          <View style={styles.card}>
            <View style={styles.cardBody}>
              <Text style={styles.codigo}>{item.codigo}</Text>
              <Text style={styles.cliente}>{item.nombreCliente}</Text>
              <Text style={styles.detalle}>Factura: {item.facturaOrigen} — ${Number(item.valor).toLocaleString('es-CO')}</Text>
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
          </View>
        )}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  hint: { padding: 12, backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: 13 },
  list: { flex: 1 },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardBody: { marginBottom: 12 },
  codigo: { fontSize: 16, fontWeight: '700', color: '#1e3a5f' },
  cliente: { fontSize: 14, color: '#334155', marginTop: 4 },
  detalle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  btnRedimir: { backgroundColor: '#16a34a', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontWeight: '600' },
  empty: { padding: 24, textAlign: 'center', color: '#64748b' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
