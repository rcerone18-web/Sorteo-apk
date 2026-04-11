import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme/ThemeProvider';

export function Header({ statusText }: { statusText: string }) {
  const { theme, toggleTheme, mode } = useAppTheme();

  return (
    <View style={[styles.outer, { backgroundColor: theme.colors.primary }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Hola, Administrador 👋</Text>
          <Text style={[styles.subtitle, { color: theme.colors.text, opacity: 0.9 }]}>{statusText}</Text>
        </View>
        <TouchableOpacity
          onPress={toggleTheme}
          accessibilityLabel="Cambiar tema"
          style={[styles.themeBtn, { backgroundColor: theme.colors.accent }]}
          activeOpacity={0.8}
        >
          <Ionicons name={mode === 'dark' ? 'moon-outline' : 'sunny-outline'} size={18} color="#1B1B1B" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTextWrap: { flex: 1, paddingRight: 12 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 13, fontWeight: '600' },
  themeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

