import React from 'react';
import { StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme/ThemeProvider';

export function Input({
  icon,
  style,
  ...props
}: TextInputProps & { icon?: React.ComponentProps<typeof Ionicons>['name']; style?: StyleProp<ViewStyle> }) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.wrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }, style]}>
      {icon ? (
        <Ionicons name={icon} size={18} color={theme.colors.primary} style={styles.icon} />
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.mutedText}
        style={[styles.input, { color: theme.colors.text }, icon ? { paddingLeft: 8 } : null]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 0 },
});

