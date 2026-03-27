import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Switch, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function MemberSettingsScreen() {
  const navigation = useNavigation();
  const { signOut, userProfile } = useAuth();
  const [reminders, setReminders] = useState(false);
  const [rewardUpdates, setRewardUpdates] = useState(true);
  const [autoStop, setAutoStop] = useState(true);
  const [saveToCameraRoll, setSaveToCameraRoll] = useState(false);

  const handleLogout = () => {
    Alert.alert('Log out?', 'Your progress is saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft color="#FFF" size={24} /></TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowLabel}>{userProfile?.email || 'Account'}</Text>
          <ChevronRight color="#6B7280" size={20} />
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Reminders</Text>
          <Switch value={reminders} onValueChange={setReminders} trackColor={{ false: '#374151', true: '#10B981' }} thumbColor="#FFF" />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Reward updates</Text>
          <Switch value={rewardUpdates} onValueChange={setRewardUpdates} trackColor={{ false: '#374151', true: '#10B981' }} thumbColor="#FFF" />
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recording</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Auto-stop after 2 hours</Text>
          <Switch value={autoStop} onValueChange={setAutoStop} trackColor={{ false: '#374151', true: '#10B981' }} thumbColor="#FFF" />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Save to camera roll</Text>
          <Switch value={saveToCameraRoll} onValueChange={setSaveToCameraRoll} trackColor={{ false: '#374151', true: '#10B981' }} thumbColor="#FFF" />
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <TouchableOpacity style={styles.row}><Text style={styles.rowLabel}>How it works</Text><ChevronRight color="#6B7280" size={20} /></TouchableOpacity>
        <TouchableOpacity style={styles.row}><Text style={styles.rowLabel}>Privacy & data</Text><ChevronRight color="#6B7280" size={20} /></TouchableOpacity>
        <TouchableOpacity style={styles.row}><Text style={styles.rowLabel}>Contact support</Text><ChevronRight color="#6B7280" size={20} /></TouchableOpacity>
      </View>
      <View style={styles.section}>
        <TouchableOpacity style={styles.logout} onPress={handleLogout}><Text style={styles.logoutText}>Log out</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1F1F1F' },
  rowLabel: { fontSize: 16, color: '#FFF' },
  logout: { paddingVertical: 14 },
  logoutText: { fontSize: 16, color: '#DC2626' },
});


