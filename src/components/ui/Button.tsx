import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}) {
  const { theme } = useAppTheme();
  const isDisabled = !!disabled || !!loading;

  const backgroundColor = variant === 'primary' ? theme.colors.primary : theme.colors.card;
  const borderColor = variant === 'primary' ? theme.colors.primary : theme.colors.border;
  const textColor = variant === 'primary' ? '#FFFFFF' : theme.colors.text;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={isDisabled}
      style={[
        styles.btn,
        { backgroundColor, borderColor },
        isDisabled && { opacity: 0.65 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});

