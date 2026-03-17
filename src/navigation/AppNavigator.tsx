import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import LoginScreen from '../screens/LoginScreen';
import FacturacionScreen from '../screens/FacturacionScreen';
import ParticipacionScreen from '../screens/ParticipacionScreen';
import ResultadoSorteoScreen from '../screens/ResultadoSorteoScreen';
import SyncScreen from '../screens/SyncScreen';
import AdminStack from './AdminStack';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { user } = useAuth();
  const { online, pendientesVentas, pendientesParticipaciones } = useSync();
  const pendientes = pendientesVentas + pendientesParticipaciones;

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1e3a5f' },
        headerTintColor: '#fff',
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tab.Screen
        name="Facturacion"
        component={FacturacionScreen}
        options={{ title: 'Facturación', tabBarLabel: 'Ventas' }}
      />
      <Tab.Screen
        name="Participacion"
        component={ParticipacionScreen}
        options={{
          title: 'Participación sorteo',
          tabBarLabel: 'Sorteo',
        }}
      />
      <Tab.Screen
        name="Sync"
        component={SyncScreen}
        options={{
          title: 'Sincronizar',
          tabBarLabel: pendientes > 0 ? `Sync (${pendientes})` : 'Sync',
        }}
      />
      {user?.rol === 'administrador' && (
        <Tab.Screen
          name="Admin"
          component={AdminStack}
          options={{ title: 'Administración', tabBarLabel: 'Admin', headerShown: false }}
        />
      )}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e3a5f' },
  loadingText: { color: '#fff', marginTop: 12 },
});

export default function AppNavigator() {
  const { user, isRestored, isLoading } = useAuth();

  if (!isRestored) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#1e3a5f' },
          headerTintColor: '#fff',
        }}
      >
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="ResultadoSorteo"
              component={ResultadoSorteoScreen}
              options={{ title: 'Resultado del sorteo' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
