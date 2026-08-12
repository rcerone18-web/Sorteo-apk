import React, { useState } from 'react';
import axios from 'axios';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeProvider';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { getApiBaseUrl, resolveAutoApiBaseUrl, setApiBaseUrlOverride } from '../config';
import * as api from '../api/client';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [showConexion, setShowConexion] = useState(false);
  const [urlServidor, setUrlServidor] = useState('');
  const [probando, setProbando] = useState(false);
  const { theme } = useAppTheme();

  const handleLogin = async () => {
    if (!usuario.trim() || !clave) {
      Alert.alert('Error', 'Ingresa usuario y contraseña');
      return;
    }
    try {
      await login(usuario.trim(), clave);
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? (e.code === 'ERR_NETWORK' ? 'No se puede conectar al servidor. Revisa la URL en "Problemas de conexión".' : e.message)
        : e instanceof Error ? e.message : 'No se pudo iniciar sesión';
      Alert.alert('Error', msg);
    }
  };

  const abrirConexion = () => {
    setUrlServidor(getApiBaseUrl());
    setShowConexion(true);
  };

  const guardarUrl = async () => {
    const url = urlServidor.trim();
    if (!url) return;
    const normalizada = url.startsWith('http') ? url : `http://${url}`;
    await setApiBaseUrlOverride(normalizada);
    setUrlServidor(normalizada);
    Alert.alert('Guardado', 'URL actualizada. Intenta iniciar sesión de nuevo.');
  };

  const usarUrlAutomatica = async () => {
    await setApiBaseUrlOverride(null);
    setUrlServidor(resolveAutoApiBaseUrl());
    Alert.alert('Listo', 'Se eliminó la URL manual. La app volverá a calcular host y puerto automáticamente.');
  };

  const probarConexion = async () => {
    setProbando(true);
    try {
      const r = await api.testConnection();
      Alert.alert(r.ok ? 'Conexión OK' : 'Sin conexión', r.mensaje);
    } finally {
      setProbando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.hero}>
        <Card style={styles.card}>
          <View style={styles.brandRow}>
            <View style={[styles.brandIcon, { backgroundColor: `${theme.colors.primary}22`, borderColor: theme.colors.border }]}>
              <Ionicons name="gift-outline" size={22} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Sorteo Promocional</Text>
              <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>Inicia sesión</Text>
            </View>
          </View>

          <View style={styles.form}>
            <Input
              icon="person-outline"
              placeholder="Usuario"
              value={usuario}
              onChangeText={setUsuario}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <Input
              icon="lock-closed-outline"
              placeholder="Contraseña"
              value={clave}
              onChangeText={setClave}
              secureTextEntry
              editable={!isLoading}
            />

            <View style={{ height: 12 }} />

            <Button title="Entrar" onPress={handleLogin} variant="primary" loading={isLoading} disabled={false} />

            <Pressable onPress={abrirConexion} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.linkConexion, { color: theme.colors.primary }]}>¿Problemas de conexión?</Text>
            </Pressable>

            <Text style={[styles.hint, { color: theme.colors.mutedText }]}>Sesión se mantiene en este dispositivo.</Text>
          </View>
        </Card>
      </View>
    <Modal visible={showConexion} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowConexion(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.colors.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Configurar servidor</Text>
            <Text style={[styles.modalHint, { color: theme.colors.mutedText }]}>
              En desarrollo la URL se calcula sola: misma IP que Metro (exp://…:8081) y puerto del API (3000 por defecto).
              Emulador Android → 10.0.2.2. Si cambias de red, usa «Usar detección automática».
            </Text>
            <Input
              placeholder={resolveAutoApiBaseUrl()}
              value={urlServidor}
              onChangeText={setUrlServidor}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <Button title="Probar conexión" onPress={probarConexion} variant="secondary" loading={probando} disabled={probando} />
              <Button title="Guardar" onPress={guardarUrl} variant="primary" />
            </View>
            <View style={{ marginTop: 12 }}>
              <Button title="Usar detección automática" onPress={usarUrlAutomatica} variant="secondary" />
            </View>
            <Pressable onPress={() => setShowConexion(false)}>
              <Text style={[styles.linkConexion, { color: theme.colors.mutedText }]}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  hero: { justifyContent: 'center' },
  card: { padding: 22 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  brandIcon: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 4 },
  subtitle: { fontSize: 16, fontWeight: '700' },
  form: { gap: 10 },
  hint: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  linkConexion: { fontSize: 14, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  modalHint: { fontSize: 13, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
});
