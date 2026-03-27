import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { MemberStackParamList } from '../../navigation/MemberNavigator';

type NavigationProp = NativeStackNavigationProp<MemberStackParamList>;

export default function MemberRewardScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ArrowLeft color="#FFF" size={24} />
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.emoji}>🎁</Text>
        <Text style={styles.title}>You did it.</Text>
        <Text style={styles.subtitle}>10 hours of cleaning.{'\n'}That's genuinely amazing.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your free professional clean is ready to schedule.</Text>
          <Text style={styles.cardDesc}>One of our cleaners will come do a full reset of your space — kitchen, bathroom, the works.</Text>
          <Text style={styles.earned}>You earned this.</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('MemberSchedule')}>
          <Text style={styles.buttonText}>Schedule My Free Clean</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  back: { position: 'absolute', top: 60, left: 20, zIndex: 10, padding: 8 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emoji: { fontSize: 80, marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  subtitle: { fontSize: 18, color: '#9CA3AF', textAlign: 'center', lineHeight: 28, marginBottom: 32 },
  card: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 24, width: '100%', marginBottom: 32 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 12 },
  cardDesc: { fontSize: 14, color: '#9CA3AF', lineHeight: 22, marginBottom: 16 },
  earned: { fontSize: 14, color: '#10B981', fontWeight: '600' },
  button: { backgroundColor: '#10B981', borderRadius: 16, padding: 20, width: '100%', alignItems: 'center' },
  buttonText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
});


