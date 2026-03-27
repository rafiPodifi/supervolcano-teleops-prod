/**
 * CLEANER NAVIGATOR
 * Navigation stack for cleaners/teleoperators
 * (Existing cleaner flow)
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LocationsScreen from '../screens/LocationsScreen';
import JobSelectScreen from '../screens/JobSelectScreen';
import CameraScreen from '../screens/CameraScreen';
import UploadQueueScreen from '../screens/UploadQueueScreen';

const Stack = createNativeStackNavigator();

export default function CleanerNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="Locations" 
        component={LocationsScreen}
      />
      <Stack.Screen
        name="JobSelect"
        component={JobSelectScreen}
      />
      <Stack.Screen 
        name="Camera" 
        component={CameraScreen}
      />
      <Stack.Screen
        name="UploadQueue"
        component={UploadQueueScreen}
      />
    </Stack.Navigator>
  );
}
