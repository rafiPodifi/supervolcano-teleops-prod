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
import GenericRecordingHubScreen from '../screens/GenericRecordingHubScreen';
import GenericPendingUploadsScreen from '../screens/GenericPendingUploadsScreen';
import FailedUploadsScreen from '../screens/FailedUploadsScreen';

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
        name="GenericRecordingHub"
        component={GenericRecordingHubScreen}
      />
      <Stack.Screen
        name="GenericPendingUploads"
        component={GenericPendingUploadsScreen}
      />
      <Stack.Screen
        name="FailedUploads"
        component={FailedUploadsScreen}
      />
      <Stack.Screen
        name="JobSelect"
        component={JobSelectScreen}
      />
      <Stack.Screen 
        name="Camera" 
        component={CameraScreen}
      />
    </Stack.Navigator>
  );
}
