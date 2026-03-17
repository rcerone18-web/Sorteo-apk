import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { isOnline } from '../../sync/syncService';
import * as api from '../../api/client';
import type { AdminMetricas } from '../../types';

const cardItems = [
  { key: 'Participaciones', title: 'Facturas registradas', screen: 'AdminParticipaciones' },
  { key: 'Sorteos', title: 'Sorteos', screen: 'AdminSorteos' },
  { key: 'Ganadores', title: 'Ganadores', screen: 'AdminGanadores' },
  { key: 'Bonos', title: 'Bonos', screen: 'AdminBonos' },
  { key: 'Redencion', title: 'Redención de bono', screen: 'AdminRedencion' },
  { key: 'Config', title: 'Configuración', screen: 'AdminConfig' },
];

export default function AdminDashboardScreen() {
  const navigation = useNavigation<{
    navigate: (screen: string) => void;
  }>();
  const { user } = useAuth();
  const [online, setOnline] = useState(false);
  const [metricas, setMetricas] = useState<AdminMetricas | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setOnline(await isOnline());
      if (await isOnline()) {
        const m = await api.getMetricas();
        setMetricas(m);
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (e instanceof Error ? e.message : 'Error al cargar métricas');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (user?.rol !== 'administrador') {
    return (
      <View style={styles.container}>
        <Text style={styles.noAccess}>No tienes acceso al panel de administración.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.statusBar, online ? styles.online : styles.offline]}>
        <Text style={styles.statusText}>{online ? 'En línea' : 'Sin conexión'}</Text>
      </View>

      <Text style={styles.sectionTitle}>Métricas</Text>
      {loading && !metricas ? (
        <ActivityIndicator size="large" color="#1e3a5f" style={styles.loader} />
      ) : metricas ? (
        <View style={styles.metricasCard}>
          <Text style={styles.metrica}>Total participaciones: {metricas.totalParticipaciones}</Text>
          <Text style={styles.metrica}>Total ganadores: {metricas.totalGanadores}</Text>
          <Text style={styles.metrica}>Tasa ganadores: {metricas.tasaObservada}%</Text>
          <Text style={styles.metrica}>Valor bonos emitidos: ${Number(metricas.valorEmitido).toLocaleString('es-CO')}</Text>
          <Text style={styles.metrica}>Valor bonos redimidos: ${Number(metricas.valorRedimido).toLocaleString('es-CO')}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>Conéctate para ver métricas.</Text>
      )}

      <Text style={styles.sectionTitle}>Secciones</Text>
      {cardItems.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.card}
          onPress={() => navigation.navigate(item.screen)}
          activeOpacity={0.7}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  statusBar: { padding: 12, borderRadius: 8, marginBottom: 16 },
  online: { backgroundColor: '#dcfce7' },
  offline: { backgroundColor: '#fecaca' },
  statusText: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12, marginTop: 8 },
  loader: { marginVertical: 24 },
  metricasCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  metrica: { fontSize: 16, color: '#334155', marginBottom: 8 },
  hint: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1e3a5f' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
