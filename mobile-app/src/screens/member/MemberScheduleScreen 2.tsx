import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

export default function MemberScheduleScreen() {
  const navigation = useNavigation();
  const [address, setAddress] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const timeSlots = [
    { id: 'morning', label: 'Morning (9am-12pm)' },
    { id: 'afternoon', label: 'Afternoon (12pm-4pm)' },
    { id: 'evening', label: 'Evening (4pm-7pm)' },
  ];

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1);
    return { id: d.toISOString().split('T')[0], label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) };
  });

  const handleConfirm = () => {
    if (!address || !selectedDate || !selectedTime) {
      Alert.alert('Almost there', 'Please fill in all fields.');
      return;
    }
    Alert.alert("You're all set!", 'Your free clean is scheduled.', [
      { text: 'Done', onPress: () => navigation.navigate('MemberHome' as never) }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft color="#FFF" size={24} /></TouchableOpacity>
          <Text style={styles.title}>Schedule Your Free Clean</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Where should we come?</Text>
          <TextInput style={styles.input} placeholder="Enter your address" placeholderTextColor="#6B7280" value={address} onChangeText={setAddress} multiline />
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>When works for you?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {dates.map((d) => (
              <TouchableOpacity key={d.id} style={[styles.chip, selectedDate === d.id && styles.chipSelected]} onPress={() => setSelectedDate(d.id)}>
                <Text style={[styles.chipText, selectedDate === d.id && styles.chipTextSelected]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={styles.section}>
          {timeSlots.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.timeSlot, selectedTime === t.id && styles.timeSlotSelected]} onPress={() => setSelectedTime(t.id)}>
              <Text style={styles.timeText}>{t.label}</Text>
              <View style={[styles.radio, selectedTime === t.id && styles.radioSelected]} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.confirm, (!address || !selectedDate || !selectedTime) && styles.confirmDisabled]} onPress={handleConfirm}>
          <Text style={styles.confirmText}>Confirm Booking</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  title: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  section: { marginBottom: 32 },
  label: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 12 },
  input: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, fontSize: 16, color: '#FFF', minHeight: 80 },
  chip: { backgroundColor: '#1A1A1A', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, marginRight: 8 },
  chipSelected: { backgroundColor: '#10B981' },
  chipText: { fontSize: 14, color: '#9CA3AF' },
  chipTextSelected: { color: '#FFF', fontWeight: '600' },
  timeSlot: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  timeSlotSelected: { borderColor: '#10B981', borderWidth: 2 },
  timeText: { fontSize: 16, color: '#FFF' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#6B7280' },
  radioSelected: { borderColor: '#10B981', backgroundColor: '#10B981' },
  confirm: { backgroundColor: '#10B981', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  confirmDisabled: { backgroundColor: '#374151' },
  confirmText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});


