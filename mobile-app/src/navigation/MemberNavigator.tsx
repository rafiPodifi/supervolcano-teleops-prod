import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MemberHomeScreen from "../screens/member/MemberHomeScreen";
import MemberRecordScreen from "../screens/member/MemberRecordScreen";
import MemberSessionsScreen from "../screens/member/MemberSessionsScreen";
import MemberRewardScreen from "../screens/member/MemberRewardScreen";
import MemberScheduleScreen from "../screens/member/MemberScheduleScreen";
import MemberSettingsScreen from "../screens/member/MemberSettingsScreen";
import SessionCompleteScreen from "../screens/member/SessionCompleteScreen";
import UploadQueueScreen from "../screens/UploadQueueScreen";
import FailedUploadsScreen from "../screens/FailedUploadsScreen";
import GenericPendingUploadsScreen from "../screens/GenericPendingUploadsScreen";

export type MemberStackParamList = {
  MemberHome: undefined;
  MemberRecord: undefined;
  MemberSessions: undefined;
  MemberReward: undefined;
  MemberSchedule: undefined;
  MemberSettings: undefined;
  UploadQueue: undefined;
  FailedUploads: undefined;
  GenericPendingUploads: undefined;
  SessionComplete: {
    sessionMinutes: number;
    totalHours: number;
    goalHours: number;
  };
};

const Stack = createNativeStackNavigator<MemberStackParamList>();

export default function MemberNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#000" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="MemberHome" component={MemberHomeScreen} />
      <Stack.Screen name="MemberRecord" component={MemberRecordScreen} />
      <Stack.Screen name="MemberSessions" component={MemberSessionsScreen} />
      <Stack.Screen name="MemberReward" component={MemberRewardScreen} />
      <Stack.Screen name="MemberSchedule" component={MemberScheduleScreen} />
      <Stack.Screen name="MemberSettings" component={MemberSettingsScreen} />
      <Stack.Screen name="UploadQueue" component={UploadQueueScreen} />
      <Stack.Screen name="FailedUploads" component={FailedUploadsScreen} />
      <Stack.Screen
        name="GenericPendingUploads"
        component={GenericPendingUploadsScreen}
      />
      <Stack.Screen
        name="SessionComplete"
        component={SessionCompleteScreen}
        options={{
          headerShown: false,
          gestureEnabled: false, // Prevent back swipe
        }}
      />
    </Stack.Navigator>
  );
}
