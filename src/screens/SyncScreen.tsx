import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';

export default function SyncScreen() {
  const { logout } = useAuth();
  const {
    online,
    pendientesVentas,
    pendientesParticipaciones,
    sincronizando,
    ultimoResultado,
    refrescarPendientes,
    ejecutarSincronizacion,
  } = useSync();

  const totalPendientes = pendientesVentas + pendientesParticipaciones;
  const puedeSincronizar = online && !sincronizando;

  const handleSync = async () => {
    if (!puedeSincronizar) return;
    const res = await ejecutarSincronizacion();
    if (res.errores.length > 0) {
      // Mostrar en pantalla; ya está en ultimoResultado
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.statusCard, online ? styles.online : styles.offline]}>
        <Text style={styles.statusLabel}>Estado</Text>
        <Text style={styles.statusValue}>{online ? 'En línea' : 'Sin conexión'}</Text>
      </View>
      <View style={styles.pendientesCard}>
        <Text style={styles.pendientesLabel}>Registros pendientes</Text>
        <Text style={styles.pendientesValue}>
          {pendientesVentas + pendientesParticipaciones} (ventas: {pendientesVentas}, participaciones: {pendientesParticipaciones})
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.refreshBtn, sincronizando && styles.buttonDisabled]}
        onPress={refrescarPendientes}
        disabled={sincronizando}
      >
        <Text style={styles.refreshText}>Actualizar estado</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.syncButton,
          (!puedeSincronizar || totalPendientes === 0) && styles.buttonDisabled,
        ]}
        onPress={handleSync}
        disabled={!puedeSincronizar || totalPendientes === 0}
      >
        {sincronizando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.syncButtonText}>Sincronizar datos</Text>
        )}
      </TouchableOpacity>
      {!online && (
        <Text style={styles.hint}>Conéctate a internet para poder sincronizar.</Text>
      )}
      {online && totalPendientes === 0 && !sincronizando && (
        <Text style={styles.hint}>No hay registros pendientes de sincronizar.</Text>
      )}
      {ultimoResultado && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Última sincronización</Text>
          <Text style={styles.resultText}>
            Ventas enviadas: {ultimoResultado.ventasEnviadas}
          </Text>
          <Text style={styles.resultText}>
            Participaciones enviadas: {ultimoResultado.participacionesEnviadas}
          </Text>
          {ultimoResultado.errores.length > 0 && (
            <View style={styles.erroresBox}>
              <Text style={styles.erroresTitle}>Errores:</Text>
              {ultimoResultado.errores.map((e, i) => (
                <Text key={i} style={styles.errorItem}>{e}</Text>
              ))}
            </View>
          )}
        </View>
      )}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => Alert.alert('Cerrar sesión', '¿Salir de la aplicación?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: logout },
        ])}
      >
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  statusCard: { borderRadius: 12, padding: 20, marginBottom: 16 },
  online: { backgroundColor: '#dcfce7' },
  offline: { backgroundColor: '#fecaca' },
  statusLabel: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  statusValue: { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  pendientesCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  pendientesLabel: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  pendientesValue: { fontSize: 18, fontWeight: '600', color: '#334155' },
  refreshBtn: { padding: 12, marginBottom: 8 },
  refreshText: { color: '#2563eb', fontSize: 16 },
  syncButton: { backgroundColor: '#2563eb', borderRadius: 10, padding: 18, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  syncButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  hint: { marginTop: 16, fontSize: 14, color: '#64748b', textAlign: 'center' },
  resultCard: { marginTop: 24, backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  resultTitle: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 12 },
  resultText: { fontSize: 15, color: '#475569', marginBottom: 4 },
  erroresBox: { marginTop: 12, padding: 12, backgroundColor: '#fef2f2', borderRadius: 8 },
  erroresTitle: { fontWeight: '600', color: '#b91c1c', marginBottom: 6 },
  errorItem: { fontSize: 13, color: '#991b1b', marginBottom: 4 },
  logoutBtn: { marginTop: 32, padding: 14, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontSize: 16 },
});
