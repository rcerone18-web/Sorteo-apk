import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

const REDIRIGIR_A_VENTAS_SEGUNDOS = 3;

function extraerCodigoDeMensaje(mensaje: string | undefined): string | null {
  if (!mensaje) return null;
  const match = mensaje.match(/Código:\s*([A-Z0-9-]+)/i) || mensaje.match(/código[:\s]+([A-Z0-9-]+)/i);
  return match ? match[1].trim() : null;
}

function irARegistrarVenta(navigation: ReturnType<typeof useNavigation>) {
  (navigation as { navigate: (name: string, params?: { screen: string }) => void }).navigate('Main', { screen: 'Facturacion' });
}

export default function ResultadoSorteoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params ?? {}) as { gano?: boolean; codigoBono?: string; compraMinimaBono?: number; mensaje?: string; offline?: boolean };
  const { gano, codigoBono, compraMinimaBono, mensaje, offline } = params;
  const codigoMostrar = codigoBono || extraerCodigoDeMensaje(mensaje);

  const spinValue = useRef(new Animated.Value(0)).current;
  const [animFinished, setAnimFinished] = useState(false);

  useEffect(() => {
    const targetTurns = gano ? 4.0 : 4.5; // 4 = verde (ganaste) bajo la flecha, 4.5 = rojo (no ganaste)
    Animated.timing(spinValue, {
      toValue: targetTurns,
      duration: 2500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setAnimFinished(true));
  }, [gano, spinValue]);

  // Redirigir automáticamente a registrar otra venta tras ver el resultado
  useEffect(() => {
    if (!animFinished) return;
    const t = setTimeout(() => irARegistrarVenta(navigation), REDIRIGIR_A_VENTAS_SEGUNDOS * 1000);
    return () => clearTimeout(t);
  }, [animFinished, navigation]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.cardOuter}>
        {/* Ruleta con dos opciones */}
        <View style={styles.rouletteWrapper}>
          <Animated.View style={[styles.roulette, { transform: [{ rotate: spin }] }]}>
            <View style={[styles.half, styles.halfGanaste]}>
              <Text style={styles.halfText}>¡Felicidades, ganaste!</Text>
            </View>
            <View style={[styles.half, styles.halfNoGano]}>
              <Text style={styles.halfText}>No ganaste</Text>
            </View>
          </Animated.View>
          <View style={styles.pointer} />
        </View>

        {/* Resultado final debajo de la ruleta */}
        <View style={[styles.card, gano ? styles.cardGano : styles.cardNoGano]}>
          <Text style={styles.emoji}>{gano ? '🎉' : '😊'}</Text>
          <Text style={styles.titulo}>{gano ? '¡Ganaste!' : 'No ganaste'}</Text>
          <Text style={styles.mensaje}>
            {mensaje ?? (gano ? 'Bono 50% en próxima compra' : 'Sigue participando')}
          </Text>
          {gano && codigoMostrar && (
            <View style={styles.bonoBox}>
              <Text style={styles.bonoLabel}>Código del bono (un solo uso)</Text>
              <Text style={styles.bonoCodigo} selectable>
                {codigoMostrar}
              </Text>
              {compraMinimaBono != null && (
                <Text style={styles.compraMin}>
                  Compra mínima para redimir: ${compraMinimaBono.toLocaleString('es-CO')}
                </Text>
              )}
            </View>
          )}
          {offline && (
            <View style={styles.offlineBox}>
              <Text style={styles.offlineText}>
                Resultado guardado localmente. Se confirmará al sincronizar con el servidor.
              </Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => irARegistrarVenta(navigation)}>
        <Text style={styles.buttonText}>Registrar otra venta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', padding: 24 },
  cardOuter: { alignItems: 'center', marginBottom: 24 },
  rouletteWrapper: { alignItems: 'center', marginBottom: 24 },
  roulette: {
    width: 220,
    height: 220,
    borderRadius: 110,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#1e3a5f',
  },
  half: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  halfGanaste: { backgroundColor: '#bbf7d0' },
  halfNoGano: { backgroundColor: '#fee2e2' },
  halfText: { fontSize: 14, fontWeight: '600', color: '#1e293b', textAlign: 'center', paddingHorizontal: 8 },
  pointer: {
    position: 'absolute',
    top: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 18,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#f97316',
  },
  card: { borderRadius: 20, padding: 28, alignItems: 'center' },
  cardGano: { backgroundColor: '#dcfce7' },
  cardNoGano: { backgroundColor: '#fef3c7' },
  emoji: { fontSize: 56, marginBottom: 12 },
  titulo: { fontSize: 26, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  mensaje: { fontSize: 16, color: '#475569', textAlign: 'center', marginBottom: 16 },
  bonoBox: { backgroundColor: '#fff', padding: 16, borderRadius: 12, width: '100%', marginTop: 8 },
  bonoLabel: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  bonoCodigo: { fontSize: 18, fontWeight: '700', color: '#059669', letterSpacing: 1 },
  compraMin: { fontSize: 13, color: '#64748b', marginTop: 8 },
  offlineBox: { marginTop: 16, padding: 12, backgroundColor: '#fef3c7', borderRadius: 8 },
  offlineText: { fontSize: 13, color: '#92400e' },
  button: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
