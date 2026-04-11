import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Alert, ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { isOnline } from '../../sync/syncService';
import * as api from '../../api/client';
import type { AdminMetricas } from '../../types';
import { useAppTheme } from '../../theme/ThemeProvider';
import { DashboardContainer } from '../../components/admin/DashboardContainer';
import { Header } from '../../components/admin/Header';
import { KpiCard } from '../../components/admin/KpiCard';
import { MenuCard } from '../../components/admin/MenuCard';
import { ChartSection } from '../../components/admin/ChartSection';

const cardItems = [
  { key: 'Participaciones', title: 'Facturas registradas', screen: 'AdminParticipaciones', icon: 'receipt-outline' as const },
  { key: 'Sorteos', title: 'Sorteos', screen: 'AdminSorteos', icon: 'game-controller-outline' as const },
  { key: 'Ganadores', title: 'Ganadores', screen: 'AdminGanadores', icon: 'trophy-outline' as const },
  { key: 'Bonos', title: 'Bonos', screen: 'AdminBonos', icon: 'gift-outline' as const },
  { key: 'Redencion', title: 'Redención de bono', screen: 'AdminRedencion', icon: 'card-outline' as const },
  { key: 'Config', title: 'Configuración', screen: 'AdminConfig', icon: 'settings-outline' as const },
];

function AdminDashboardContent() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<{
    navigate: (screen: string) => void;
  }>();
  const { user } = useAuth();
  const [online, setOnline] = useState(false);
  const [metricas, setMetricas] = useState<AdminMetricas | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

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
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.noAccess, { color: theme.colors.mutedText }]}>No tienes acceso al panel de administración.</Text>
      </View>
    );
  }

  const headerAnim = useRef(new Animated.Value(0)).current;
  const chartAnim = useRef(new Animated.Value(0)).current;
  const kpiAnims = useRef(Array.from({ length: 5 }).map(() => new Animated.Value(0))).current;
  const menuAnims = useRef(Array.from({ length: 6 }).map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!metricas || hasAnimated) return;
    headerAnim.setValue(0);
    chartAnim.setValue(0);
    kpiAnims.forEach((v) => v.setValue(0));
    menuAnims.forEach((v) => v.setValue(0));

    const fadeSlideIn = (v: Animated.Value, delayMs: number) =>
      Animated.timing(v, { toValue: 1, duration: 550, delay: delayMs, useNativeDriver: true });

    Animated.parallel([
      fadeSlideIn(headerAnim, 0),
      fadeSlideIn(chartAnim, 220),
      Animated.stagger(60, kpiAnims.map((v, idx) => fadeSlideIn(v, 120 + idx * 60))),
      Animated.stagger(55, menuAnims.map((v, idx) => fadeSlideIn(v, 260 + idx * 45))),
    ]).start(() => setHasAnimated(true));
  }, [metricas, hasAnimated, headerAnim, chartAnim, kpiAnims, menuAnims]);

  const headerStyle = useMemo(() => {
    return {
      opacity: headerAnim,
      transform: [
        {
          translateY: headerAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0],
          }),
        },
      ],
    };
  }, [headerAnim]);

  const chartStyle = useMemo(() => {
    return {
      opacity: chartAnim,
      transform: [
        {
          translateY: chartAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0],
          }),
        },
      ],
    };
  }, [chartAnim]);

  const metricasCards = useMemo(() => {
    if (!metricas) return [];
    return [
      { value: String(metricas.totalParticipaciones ?? 0), label: 'Total participaciones', icon: 'receipt-outline' as const },
      { value: String(metricas.totalGanadores ?? 0), label: 'Total ganadores', icon: 'trophy-outline' as const },
      { value: `${Number(metricas.tasaObservada ?? 0).toFixed(2)}%`, label: 'Tasa ganadora', icon: 'game-controller-outline' as const },
      { value: `$${Number(metricas.valorEmitido ?? 0).toLocaleString('es-CO')}`, label: 'Bonos emitidos', icon: 'gift-outline' as const },
      { value: `$${Number(metricas.valorRedimido ?? 0).toLocaleString('es-CO')}`, label: 'Bonos redimidos', icon: 'card-outline' as const },
    ];
  }, [metricas]);

  return (
    <DashboardContainer>
      <ScrollView
        style={[styles.container]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Animated.View style={[headerStyle]}>
          <Header statusText={online ? 'En línea' : 'Sin conexión'} />
        </Animated.View>

        {loading && !metricas ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : metricas ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Métricas</Text>

            <View style={styles.kpiGrid}>
              {metricasCards.map((c, idx) => {
                const v = kpiAnims[idx];
                return (
                  <Animated.View key={c.label} style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
                    <KpiCard value={c.value} label={c.label} iconName={c.icon as any} />
                  </Animated.View>
                );
              })}
            </View>

            <Animated.View style={[chartStyle]}>
              <ChartSection metricas={metricas} />
            </Animated.View>

            <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 18 }]}>Secciones</Text>

            <View style={styles.menuGrid}>
              {cardItems.map((item, idx) => {
                const v = menuAnims[idx];
                return (
                  <Animated.View
                    key={item.key}
                    style={{
                      opacity: v,
                      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                      width: '48%',
                    }}
                  >
                    <MenuCard title={item.title} iconName={item.icon} onPress={() => navigation.navigate(item.screen)} />
                  </Animated.View>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={[styles.hint, { color: theme.colors.mutedText }]}>Conéctate para ver métricas.</Text>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </DashboardContainer>
  );
}

export default function AdminDashboardScreen() {
  return <AdminDashboardContent />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, marginTop: 8 },
  loader: { marginVertical: 24 },
  hint: { fontSize: 14, color: '#64748b', marginBottom: 24, textAlign: 'center' },
  noAccess: { fontSize: 16, textAlign: 'center', marginTop: 40 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
