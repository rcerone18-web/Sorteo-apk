import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as api from '../api/client';
import { isOnline } from '../sync/syncService';

export default function AdminScreen() {
  const { user } = useAuth();
  const [online, setOnline] = useState(false);
  const [metricas, setMetricas] = useState<{
    totalVentas: number;
    totalParticipaciones: number;
    totalGanadores: number;
    totalBonosRedimidos: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setOnline(await isOnline());
    })();
  }, []);

  const cargarMetricas = async () => {
    if (!online) {
      Alert.alert('Sin conexión', 'Las métricas requieren conexión al servidor.');
      return;
    }
    setLoading(true);
    try {
      const m = await api.getMetricas();
      setMetricas(m);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudieron cargar las métricas');
    } finally {
      setLoading(false);
    }
  };

  if (user?.rol !== 'administrador') {
    return (
      <View style={styles.container}>
        <Text style={styles.noAccess}>No tienes acceso al panel de administración.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Panel administrador</Text>
      <View style={[styles.statusBar, online ? styles.online : styles.offline]}>
        <Text style={styles.statusText}>{online ? 'En línea' : 'Sin conexión'}</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={cargarMetricas} disabled={!online || loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Cargar métricas</Text>}
      </TouchableOpacity>
      {metricas && (
        <View style={styles.metricasCard}>
          <Text style={styles.metrica}>Total ventas: {metricas.totalVentas}</Text>
          <Text style={styles.metrica}>Total participaciones: {metricas.totalParticipaciones}</Text>
          <Text style={styles.metrica}>Total ganadores: {metricas.totalGanadores}</Text>
          <Text style={styles.metrica}>Bonos redimidos: {metricas.totalBonosRedimidos}</Text>
        </View>
      )}
      <Text style={styles.hint}>
        Listados (facturas, participaciones, sorteos, ganadores, bonos) y configuración (probabilidad, compra mínima, presentaciones) se gestionan desde el mismo API del servidor. En esta app se muestran solo métricas básicas; el resto puede hacerse desde el backend o una web admin.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  statusBar: { padding: 12, borderRadius: 8, marginBottom: 16 },
  online: { backgroundColor: '#dcfce7' },
  offline: { backgroundColor: '#fecaca' },
  statusText: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  button: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  metricasCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  metrica: { fontSize: 16, color: '#334155', marginBottom: 8 },
  hint: { marginTop: 20, fontSize: 14, color: '#64748b' },
  noAccess: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 40 },
});
