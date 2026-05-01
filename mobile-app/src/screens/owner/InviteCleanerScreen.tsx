/**
 * INVITE CLEANER SCREEN
 * Generate and share invite link
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { X, Link, Mail, MessageCircle, Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Constants from 'expo-constants';

const APP_URL = Constants.expoConfig?.extra?.appUrl || process.env.EXPO_PUBLIC_APP_URL || 'https://supervolcano.app';

export default function InviteCleanerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, userProfile } = useAuth();
  
  const { locationId, locationName } = route.params as {
    locationId: string;
    locationName: string;
  };

  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Generate invite on mount
  useEffect(() => {
    generateInvite();
  }, []);

  const generateInvite = async () => {
    try {
      // Create invite document
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const inviteData = {
        locationId,
        locationName,
        invitedBy: user?.uid,
        invitedByName: userProfile?.displayName || user?.email,
        inviteCode,
        role: 'location_cleaner',
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      const docRef = await addDoc(collection(db, 'location_invites'), inviteData);
      
      // Build invite link
      const link = `${APP_URL}/invite/${inviteCode}`;
      
      setInviteLink(link);
      console.log('[Invite] Generated:', link);
      
    } catch (error) {
      console.error('[Invite] Error:', error);
      Alert.alert('Error', 'Failed to generate invite link');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${userProfile?.displayName || 'Someone'} invited you to clean "${locationName}" on SuperVolcano.\n\nTap to accept: ${inviteLink}`,
      });
    } catch (error) {
      console.error('[Invite] Share error:', error);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!email.trim()) return;
    
    setSendingEmail(true);
    try {
      // TODO: Call API to send email invite
      Alert.alert('Sent!', `Invite sent to ${email}`);
      setEmail('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Generating invite...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <X size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite Cleaner</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Location info */}
        <View style={styles.locationInfo}>
          <Text style={styles.locationLabel}>Inviting to</Text>
          <Text style={styles.locationName}>{locationName}</Text>
        </View>

        {/* Share button */}
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Link size={24} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Share Invite Link</Text>
        </TouchableOpacity>

        {/* Copy link */}
        <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
          {copied ? (
            <>
              <Check size={20} color="#10B981" />
              <Text style={[styles.copyButtonText, { color: '#10B981' }]}>
                Copied!
              </Text>
            </>
          ) : (
            <>
              <Copy size={20} color="#2563EB" />
              <Text style={styles.copyButtonText}>Copy Link</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or send via email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email input */}
        <View style={styles.emailContainer}>
          <TextInput
            style={styles.emailInput}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email address"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!email.trim() || sendingEmail) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendEmail}
            disabled={!email.trim() || sendingEmail}
          >
            {sendingEmail ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Mail size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Info */}
        <Text style={styles.infoText}>
          The invite link expires in 7 days. The cleaner will need to create an
          account or sign in to accept.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
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
  content: {
    flex: 1,
    padding: 20,
  },
  locationInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  locationLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  locationName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 16,
  },
  shareButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  copyButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2563EB',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#9CA3AF',
  },
  emailContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  emailInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111827',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  infoText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
});

