import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';

export function DashboardContainer({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return <View style={[styles.container, { backgroundColor: theme.colors.background }]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

