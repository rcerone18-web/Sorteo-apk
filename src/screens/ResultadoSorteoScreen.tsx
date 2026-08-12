import React, { useEffect, useRef, useState } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAppTheme } from '../theme/ThemeProvider';
import { Button } from '../components/ui/Button';

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
  const params = (route.params ?? {}) as {
    gano?: boolean;
    codigoBono?: string;
    compraMinimaBono?: number;
    mensaje?: string;
    offline?: boolean;
    leyendaFacturaBono?: string;
    probabilidadUtilizada?: number;
  };
  const { gano, codigoBono, compraMinimaBono, mensaje, offline, leyendaFacturaBono, probabilidadUtilizada } = params;
  const { theme } = useAppTheme();
  const codigoMostrar = codigoBono || extraerCodigoDeMensaje(mensaje);

  const spinValue = useRef(new Animated.Value(0)).current;
  const [animFinished, setAnimFinished] = useState(false);
  const [printing, setPrinting] = useState(false);

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
    // Si ganó, dejamos la pantalla abierta para que pueda imprimir el ticket.
    if (gano && codigoMostrar) return;
    const t = setTimeout(() => irARegistrarVenta(navigation), REDIRIGIR_A_VENTAS_SEGUNDOS * 1000);
    return () => clearTimeout(t);
  }, [animFinished, navigation, gano, codigoMostrar]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.cardOuter}>
        {/* Ruleta con dos opciones */}
        <View style={styles.rouletteWrapper}>
          <Animated.View style={[styles.roulette, { transform: [{ rotate: spin }], borderColor: theme.colors.primary }]}>
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
          <Text style={[styles.titulo, { color: theme.colors.text }]}>{gano ? '¡Ganaste!' : 'No ganaste'}</Text>
          <Text style={[styles.mensaje, { color: theme.colors.mutedText }]}>
            {mensaje ?? (gano ? 'Bono 50% en próxima compra' : 'Sigue participando')}
          </Text>
          {gano && codigoMostrar && (
            <View style={styles.bonoBox}>
              <Text style={[styles.bonoLabel, { color: theme.colors.mutedText }]}>Código del bono (un solo uso)</Text>
              <Text style={styles.bonoCodigo} selectable>
                {codigoMostrar}
              </Text>
              {compraMinimaBono != null && (
                <Text style={[styles.compraMin, { color: theme.colors.mutedText }]}>
                  Compra mínima para redimir: ${compraMinimaBono.toLocaleString('es-CO')}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.ticketBtn, printing && styles.buttonDisabled, { backgroundColor: theme.colors.primary }]}
                onPress={async () => {
                  if (printing) return;
                  if (!codigoMostrar) return;
                  setPrinting(true);
                  try {
                    const compraMin = compraMinimaBono != null ? compraMinimaBono.toLocaleString('es-CO') : '—';
                    const fecha = new Date().toLocaleDateString('es-CO');
                    const leyenda = leyendaFacturaBono || 'ESTA FACTURA CONTIENE UN BONO';
                    const probTxt =
                      probabilidadUtilizada != null && !Number.isNaN(probabilidadUtilizada)
                        ? `Probabilidad aplicada: ${(probabilidadUtilizada * 100).toFixed(2)}%`
                        : '';
                    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial; padding: 24px; }
      .title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
      .subtitle { color: #475569; margin-bottom: 16px; }
      .leyenda { font-size: 16px; font-weight: 800; letter-spacing: 0.02em; text-align: center; margin: 12px 0; padding: 12px; border: 2px solid #059669; border-radius: 8px; color: #065f46; }
      .box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
      .label { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 6px; }
      .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
      .min { font-size: 14px; color: #334155; margin-top: 10px; }
      .footer { color: #64748b; font-size: 12px; margin-top: 18px; }
    </style>
  </head>
  <body>
    <div class="title">Sorteo Promocional</div>
    <div class="subtitle">Tiquete de bono</div>
    <div class="leyenda">${leyenda}</div>
    <div class="box">
      <div class="label">Fecha</div>
      <div class="value">${fecha}</div>

      <div class="label">Código del bono (un solo uso)</div>
      <div class="value">${codigoMostrar}</div>

      <div class="min">Compra mínima para redimir: $${compraMin}</div>
      ${probTxt ? `<div class="min">${probTxt}</div>` : ''}
    </div>
    <div class="footer">Incluir la misma leyenda en la factura impresa cuando corresponda. Sujeto a términos del sorteo.</div>
  </body>
</html>`;

                    const { uri } = await Print.printToFileAsync({ html });
                    const canShare = await Sharing.isAvailableAsync();
                    if (!canShare) {
                      Alert.alert('Imprimir', 'No se puede generar la impresión en este dispositivo.');
                      return;
                    }
                    await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
                  } catch (e: unknown) {
                    Alert.alert('Imprimir', e instanceof Error ? e.message : 'No se pudo generar el PDF');
                  } finally {
                    setPrinting(false);
                  }
                }}
                disabled={printing}
              >
                <Text style={styles.ticketBtnText}>Imprimir ticket</Text>
              </TouchableOpacity>
            </View>
          )}
          {offline && (
            <View style={styles.offlineBox}>
              <Text style={[styles.offlineText, { color: theme.colors.accent }]}>
                Resultado guardado localmente. Se confirmará al sincronizar con el servidor.
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={{ paddingHorizontal: 24 }}>
        <Button title="Registrar otra venta" onPress={() => irARegistrarVenta(navigation)} variant="primary" />
      </View>
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
  ticketBtn: { backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginTop: 14, alignItems: 'center' },
  ticketBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  offlineBox: { marginTop: 16, padding: 12, backgroundColor: '#fef3c7', borderRadius: 8 },
  offlineText: { fontSize: 13, color: '#92400e' },
  button: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
});
