import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminParticipacionesScreen from '../screens/admin/AdminParticipacionesScreen';
import AdminSorteosScreen from '../screens/admin/AdminSorteosScreen';
import AdminGanadoresScreen from '../screens/admin/AdminGanadoresScreen';
import AdminBonosScreen from '../screens/admin/AdminBonosScreen';
import AdminRedencionScreen from '../screens/admin/AdminRedencionScreen';
import AdminConfigScreen from '../screens/admin/AdminConfigScreen';

const Stack = createNativeStackNavigator();

export default function AdminStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1e3a5f' },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: 'Administración' }}
      />
      <Stack.Screen
        name="AdminParticipaciones"
        component={AdminParticipacionesScreen}
        options={{ title: 'Facturas registradas' }}
      />
      <Stack.Screen
        name="AdminSorteos"
        component={AdminSorteosScreen}
        options={{ title: 'Sorteos' }}
      />
      <Stack.Screen
        name="AdminGanadores"
        component={AdminGanadoresScreen}
        options={{ title: 'Ganadores' }}
      />
      <Stack.Screen
        name="AdminBonos"
        component={AdminBonosScreen}
        options={{ title: 'Bonos' }}
      />
      <Stack.Screen
        name="AdminRedencion"
        component={AdminRedencionScreen}
        options={{ title: 'Redención de bono' }}
      />
      <Stack.Screen
        name="AdminConfig"
        component={AdminConfigScreen}
        options={{ title: 'Configuración' }}
      />
    </Stack.Navigator>
  );
}
