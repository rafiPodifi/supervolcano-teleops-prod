import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, SectionList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Clock, Check } from 'lucide-react-native';

interface Session { id: string; date: string; durationMinutes: number; validated: boolean; }
interface Section { title: string; totalMinutes: number; data: Session[]; }

export default function MemberSessionsScreen() {
  const navigation = useNavigation();
  const sections: Section[] = [
    { title: 'This week', totalMinutes: 142, data: [
      { id: '1', date: 'Today', durationMinutes: 47, validated: true },
      { id: '2', date: 'Yesterday', durationMinutes: 72, validated: true },
      { id: '3', date: 'Dec 16', durationMinutes: 23, validated: true },
    ]},
    { title: 'Last week', totalMinutes: 108, data: [
      { id: '4', date: 'Dec 12', durationMinutes: 38, validated: true },
      { id: '5', date: 'Dec 10', durationMinutes: 55, validated: true },
      { id: '6', date: 'Dec 8', durationMinutes: 15, validated: true },
    ]},
  ];

  const formatDuration = (m: number) => m < 60 ? `${m} min` : `${Math.floor(m/60)}hr${m%60 ? ` ${m%60}min` : ''}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft color="#FFF" size={24} /></TouchableOpacity>
        <Text style={styles.title}>Your Sessions</Text>
        <View style={{ width: 24 }} />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionTotal}>{formatDuration(section.totalMinutes)}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Clock color="#6B7280" size={16} />
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.duration}>{formatDuration(item.durationMinutes)}</Text>
            {item.validated && <Check color="#10B981" size={16} />}
          </View>
        )}
        contentContainerStyle={styles.list}
        ListFooterComponent={() => (
          <View style={styles.footer}>
            <Text style={styles.footerTitle}>All time</Text>
            <Text style={styles.stat}>Total sessions: 14</Text>
            <Text style={styles.stat}>Total time: 10.4 hours</Text>
            <Text style={styles.stat}>Rewards earned: 1 free clean</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  list: { padding: 20, paddingTop: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1F1F1F' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' },
  sectionTotal: { fontSize: 14, color: '#6B7280' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F1F1F' },
  date: { fontSize: 14, color: '#9CA3AF', flex: 1 },
  duration: { fontSize: 14, color: '#FFF', fontWeight: '500', marginRight: 8 },
  footer: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#374151' },
  footerTitle: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 16 },
  stat: { fontSize: 14, color: '#9CA3AF', paddingVertical: 4 },
});


