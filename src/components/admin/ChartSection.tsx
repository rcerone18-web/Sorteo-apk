import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { useAppTheme } from '../../theme/ThemeProvider';
import type { AdminMetricas } from '../../types';

const { width: screenWidth } = Dimensions.get('window');

export function ChartSection({ metricas }: { metricas: AdminMetricas }) {
  const { theme } = useAppTheme();

  const participaciones = Number(metricas.totalParticipaciones ?? 0);
  const ganadores = Number(metricas.totalGanadores ?? 0);
  const tasa = Number(metricas.tasaObservada ?? 0);

  const chartWidth = Math.max(240, Math.floor(screenWidth - 32));

  const barData = {
    labels: ['Participaciones', 'Ganadores'],
    datasets: [{ data: [participaciones, ganadores] }],
  };

  const chartConfig = {
    backgroundGradientFrom: theme.colors.card,
    backgroundGradientTo: theme.colors.card,
    color: (opacity: number = 1) => `rgba(${hexToRgb(theme.colors.text).join(', ')}, ${opacity})`,
    labelColor: (opacity: number = 1) => `rgba(${hexToRgb(theme.colors.mutedText).join(', ')}, ${opacity})`,
    decimalPlaces: 0,
    propsForLabels: { fontSize: 11 },
  };

  // PieChart usa una "population" arbitraria; lo representamos como porcentaje sobre 100.
  const win = Math.max(0, Math.min(100, tasa));
  const lose = Math.max(0, 100 - win);
  const pieData = [
    { name: 'Ganadores', population: win, color: theme.colors.accent, legendFontColor: theme.colors.text, legendFontSize: 12 },
    { name: 'No ganadores', population: lose, color: theme.colors.primary, legendFontColor: theme.colors.text, legendFontSize: 12 },
  ];

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Resumen visual</Text>

      <View style={styles.chartBlock}>
        <Text style={[styles.chartTitle, { color: theme.colors.mutedText }]}>Participaciones vs Ganadores</Text>
        <BarChart
          data={barData as any}
          width={chartWidth}
          height={220}
          fromZero
          chartConfig={chartConfig as any}
          yAxisLabel=""
          yAxisSuffix=""
          verticalLabelRotation={0}
        />
      </View>

      <View style={styles.chartBlock}>
        <Text style={[styles.chartTitle, { color: theme.colors.mutedText }]}>Tasa ganadora</Text>
        <PieChart
          data={pieData as any}
          width={chartWidth}
          height={200}
          accessor="population"
          chartConfig={chartConfig as any}
          backgroundColor="transparent"
          paddingLeft="0"
          absolute
          hasLegend
          style={{ marginTop: 8 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  title: { fontSize: 16, fontWeight: '900', marginBottom: 10 },
  chartBlock: { marginTop: 12 },
  chartTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
});

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const normalized = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r, g, b];
}

