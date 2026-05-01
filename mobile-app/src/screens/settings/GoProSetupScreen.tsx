/**
 * GOPRO SETUP SCREEN
 * One-time pairing flow for cleaners
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Bluetooth, Check, X } from 'lucide-react-native';
import { useGoPro } from '../../contexts/GoProContext';

export default function GoProSetupScreen({ navigation }: any) {
  const { 
    status, 
    isScanning, 
    foundDevices, 
    hasPairedDevice,
    scan, 
    stopScan, 
    connect, 
    forgetDevice 
  } = useGoPro();

  const handleConnect = async (deviceId: string) => {
    const success = await connect(deviceId);
    if (success) {
      Alert.alert('Connected!', 'Your GoPro is now paired and will auto-connect.');
      navigation.goBack();
    } else {
      Alert.alert('Failed', 'Could not connect to GoPro. Make sure it\'s turned on.');
    }
  };

  const handleForget = () => {
    Alert.alert(
      'Forget GoPro?',
      'You\'ll need to pair again to use recording features.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Forget', style: 'destructive', onPress: forgetDevice },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Camera size={40} color="#3B82F6" />
        </View>
        <Text style={styles.title}>GoPro Setup</Text>
        <Text style={styles.subtitle}>
          {hasPairedDevice 
            ? 'Your GoPro is paired and ready'
            : 'Pair your GoPro for automatic session recording'
          }
        </Text>
      </View>

      {/* Current Status */}
      {hasPairedDevice && (
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[
              styles.statusDot, 
              { backgroundColor: status.isConnected ? '#10B981' : '#F59E0B' }
            ]} />
            <Text style={styles.statusText}>
              {status.isConnected ? 'Connected' : 'Not in range'}
            </Text>
          </View>
          
          {status.isConnected && (
            <>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Battery:</Text>
                <Text style={styles.statusValue}>{status.batteryLevel}%</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Storage:</Text>
                <Text style={styles.statusValue}>{status.storageRemaining}</Text>
              </View>
            </>
          )}

          <TouchableOpacity style={styles.forgetButton} onPress={handleForget}>
            <X size={16} color="#EF4444" />
            <Text style={styles.forgetText}>Forget this GoPro</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scan Section */}
      {!hasPairedDevice && (
        <>
          <TouchableOpacity 
            style={styles.scanButton}
            onPress={isScanning ? stopScan : scan}
          >
            {isScanning ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.scanButtonText}>Scanning...</Text>
              </>
            ) : (
              <>
                <Bluetooth size={20} color="#fff" />
                <Text style={styles.scanButtonText}>Find GoPro</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Found Devices */}
          {foundDevices.length > 0 && (
            <View style={styles.deviceList}>
              <Text style={styles.sectionTitle}>Found Devices</Text>
              <FlatList
                data={foundDevices}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.deviceItem}
                    onPress={() => handleConnect(item.id)}
                  >
                    <Camera size={24} color="#6B7280" />
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{item.name}</Text>
                      <Text style={styles.deviceId}>Tap to connect</Text>
                    </View>
                    <Check size={20} color="#3B82F6" />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionTitle}>Setup Instructions:</Text>
            <Text style={styles.instructionText}>1. Turn on your GoPro</Text>
            <Text style={styles.instructionText}>2. Make sure Bluetooth is enabled on your phone</Text>
            <Text style={styles.instructionText}>3. Tap "Find GoPro" above</Text>
            <Text style={styles.instructionText}>4. Select your GoPro from the list</Text>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  forgetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  forgetText: {
    color: '#EF4444',
    marginLeft: 8,
    fontWeight: '500',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceList: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  deviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  deviceId: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  instructions: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
});

