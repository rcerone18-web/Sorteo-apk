import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { SyncProvider } from './src/context/SyncContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </SyncProvider>
    </AuthProvider>
  );
}
