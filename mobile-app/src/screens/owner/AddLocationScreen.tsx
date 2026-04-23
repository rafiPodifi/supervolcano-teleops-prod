/**
 * ADD LOCATION SCREEN
 * Address autocomplete + location naming
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, MapPin, Building2, ArrowRight, Check } from 'lucide-react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../config/firebase';
import Constants from 'expo-constants';
import UseCurrentLocation from '../../components/UseCurrentLocation';
import { AddressResult } from '../../services/location.service';
import { getFriendlyErrorCopy } from '@/utils/user-facing-error';

const GOOGLE_PLACES_API_KEY = Constants.expoConfig?.extra?.googlePlacesApiKey || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://your-api.vercel.app';

interface AddressData {
  fullAddress: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export default function AddLocationScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  const [step, setStep] = useState<'address' | 'name'>('address');
  const [addressData, setAddressData] = useState<AddressData | null>(null);
  const [locationName, setLocationName] = useState('');
  const [saving, setSaving] = useState(false);
  
  const nameInputRef = useRef<TextInput>(null);
  const googlePlacesRef = useRef<any>(null);

  const handleAddressSelect = (data: any, details: any) => {
    console.log('[AddLocation] Address selected:', data.description);
    
    // Parse address components
    const addressComponents = details?.address_components || [];
    const getComponent = (type: string) => 
      addressComponents.find((c: any) => c.types.includes(type))?.long_name;
    
    const parsed: AddressData = {
      fullAddress: data.description,
      street: `${getComponent('street_number') || ''} ${getComponent('route') || ''}`.trim(),
      city: getComponent('locality') || getComponent('sublocality'),
      state: getComponent('administrative_area_level_1'),
      zip: getComponent('postal_code'),
      country: getComponent('country'),
      lat: details?.geometry?.location?.lat,
      lng: details?.geometry?.location?.lng,
    };
    
    setAddressData(parsed);
    setStep('name');
    
    // Auto-generate a suggested name
    if (parsed.city) {
      setLocationName(`${parsed.city} Property`);
    }
    
    setTimeout(() => nameInputRef.current?.focus(), 300);
  };

  const handleLocationFound = (address: AddressResult) => {
    console.log('[AddLocation] Location found:', address);
    
    // Create a data structure that matches GooglePlacesAutocomplete format
    const addressComponents: any[] = [];
    
    if (address.streetNumber) {
      addressComponents.push({ long_name: address.streetNumber, types: ['street_number'] });
    }
    if (address.street) {
      addressComponents.push({ long_name: address.street, types: ['route'] });
    }
    if (address.city) {
      addressComponents.push({ long_name: address.city, types: ['locality'] });
    }
    if (address.region) {
      addressComponents.push({ long_name: address.region, types: ['administrative_area_level_1'] });
    }
    if (address.postalCode) {
      addressComponents.push({ long_name: address.postalCode, types: ['postal_code'] });
    }
    if (address.country) {
      addressComponents.push({ long_name: address.country, types: ['country'] });
    }
    
    const mockData = {
      description: address.formattedAddress,
    };
    
    const mockDetails = {
      address_components: addressComponents,
      geometry: {
        location: {
          lat: address.latitude,
          lng: address.longitude,
        },
      },
    };
    
    // Set the address using the same handler as GooglePlacesAutocomplete
    handleAddressSelect(mockData, mockDetails);
    
    // Also set the text in the GooglePlacesAutocomplete field if ref is available
    if (googlePlacesRef.current) {
      // Try to set the text using the component's method
      try {
        googlePlacesRef.current.setAddressText?.(address.formattedAddress);
      } catch (e) {
        console.log('[AddLocation] Could not set autocomplete text directly');
      }
    }
  };

  const handleCreate = async () => {
    if (!addressData || !locationName.trim()) return;
    
    setSaving(true);
    
    try {
      console.log('[AddLocation] Creating location via API...');
      
      // Debug: check auth state
      console.log('[AddLocation] auth.currentUser:', auth.currentUser?.email);
      
      // Get token from Firebase auth directly
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        console.error('[AddLocation] No currentUser - auth state:', auth);
        throw new Error('Not authenticated');
      }
      const token = await firebaseUser.getIdToken();
      console.log('[AddLocation] Got token');
      
      const response = await fetch(
        `${API_BASE_URL}/api/locations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: locationName.trim(),
            address: addressData.fullAddress,
            addressData: {
              street: addressData.street,
              city: addressData.city,
              state: addressData.state,
              zip: addressData.zip,
              country: addressData.country,
              coordinates: {
                lat: addressData.lat,
                lng: addressData.lng,
              },
            },
          }),
        }
      );
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create location');
      }
      
      console.log('[AddLocation] Created location:', data.locationId);
      
      // Navigate to wizard
      navigation.replace('LocationWizard', {
        locationId: data.locationId,
        locationName: locationName.trim(),
      });
      
    } catch (error: any) {
      console.error('[AddLocation] Error:', error);
      const friendly = getFriendlyErrorCopy(error, 'location_save');
      Alert.alert(friendly.title, friendly.message);
      setSaving(false);
    }
  };

  const renderAddressStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where is your property?</Text>
      <Text style={styles.stepSubtitle}>
        Search for your address below
      </Text>
      
      {GOOGLE_PLACES_API_KEY ? (
        <>
          <GooglePlacesAutocomplete
            ref={googlePlacesRef}
            placeholder="Search address..."
            onPress={handleAddressSelect}
            fetchDetails={true}
            query={{
              key: GOOGLE_PLACES_API_KEY,
              language: 'en',
              types: 'address',
            }}
            styles={{
              container: styles.autocompleteContainer,
              textInput: styles.autocompleteInput,
              listView: styles.autocompleteList,
              row: styles.autocompleteRow,
              description: styles.autocompleteDescription,
              separator: styles.autocompleteSeparator,
            }}
            enablePoweredByContainer={false}
            debounce={300}
            minLength={3}
            keyboardShouldPersistTaps="handled"
          />
          
          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>
          
          {/* Use Current Location Button */}
          <UseCurrentLocation onAddressFound={handleLocationFound} />
        </>
      ) : (
        <View style={styles.apiKeyWarning}>
          <Text style={styles.apiKeyWarningText}>
            Google Places API key not configured. Please set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY.
          </Text>
        </View>
      )}
    </View>
  );

  const renderNameStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity
        style={styles.selectedAddress}
        onPress={() => setStep('address')}
      >
        <MapPin size={20} color="#2563EB" />
        <Text style={styles.selectedAddressText} numberOfLines={2}>
          {addressData?.fullAddress}
        </Text>
        <Text style={styles.changeText}>Change</Text>
      </TouchableOpacity>
      
      <Text style={styles.stepTitle}>Name your property</Text>
      <Text style={styles.stepSubtitle}>
        Choose a name that helps you identify this location
      </Text>
      
      <View style={styles.inputContainer}>
        <Building2 size={20} color="#9CA3AF" style={styles.inputIcon} />
        <TextInput
          ref={nameInputRef}
          style={styles.input}
          value={locationName}
          onChangeText={setLocationName}
          placeholder="e.g., Beach House, Downtown Condo"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        {locationName.length > 0 && (
          <Check size={20} color="#10B981" />
        )}
      </View>
      
      <TouchableOpacity
        style={[
          styles.createButton,
          (!locationName.trim() || saving) && styles.createButtonDisabled,
        ]}
        onPress={handleCreate}
        disabled={!locationName.trim() || saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.createButtonText}>Continue to Setup</Text>
            <ArrowRight size={20} color="#FFFFFF" />
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <X size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Location</Text>
          <View style={styles.headerSpacer} />
        </View>
        
        {/* Progress */}
        <View style={styles.progress}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={[styles.progressLine, step === 'name' && styles.progressLineActive]} />
          <View style={[styles.progressDot, step === 'name' && styles.progressDotActive]} />
        </View>
        
        <View style={styles.content}>
          {step === 'address' ? renderAddressStep() : renderNameStep()}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    backgroundColor: '#2563EB',
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#2563EB',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
  },
  autocompleteContainer: {
    flex: 0,
  },
  autocompleteInput: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  autocompleteList: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  autocompleteRow: {
    padding: 14,
  },
  autocompleteDescription: {
    fontSize: 15,
    color: '#374151',
  },
  autocompleteSeparator: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  apiKeyWarning: {
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    marginTop: 8,
  },
  apiKeyWarningText: {
    fontSize: 14,
    color: '#D97706',
    textAlign: 'center',
  },
  selectedAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  selectedAddressText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    marginLeft: 10,
  },
  changeText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F9FAFB',
    marginBottom: 24,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#111827',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
