import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export type CameraMode = 'native' | 'external';

type CameraModeToggleProps = {
  value: CameraMode;
  onChange: (value: CameraMode) => void;
  externalDisabled?: boolean;
  disabled?: boolean;
};

export default function CameraModeToggle({
  value,
  onChange,
  externalDisabled = false,
  disabled = false,
}: CameraModeToggleProps) {
  const handleChange = (mode: CameraMode) => {
    if (disabled) {
      return;
    }
    if (mode === 'external' && externalDisabled) {
      return;
    }
    onChange(mode);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.option,
          value === 'native' && styles.optionActive,
          disabled && styles.optionDisabled,
        ]}
        onPress={() => handleChange('native')}
        activeOpacity={0.8}
        disabled={disabled}
        testID="camera-mode-native"
      >
        <Text style={[styles.optionText, value === 'native' && styles.optionTextActive]}>
          Native
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.option,
          value === 'external' && styles.optionActive,
          externalDisabled && styles.optionDisabled,
        ]}
        onPress={() => handleChange('external')}
        activeOpacity={0.8}
        disabled={disabled || externalDisabled}
        testID="camera-mode-external"
      >
        <Text
          style={[
            styles.optionText,
            value === 'external' && styles.optionTextActive,
            externalDisabled && styles.optionTextDisabled,
          ]}
        >
          External
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 18,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  optionActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  optionDisabled: {
    opacity: 0.55,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.2,
  },
  optionTextActive: {
    color: '#fff',
  },
  optionTextDisabled: {
    color: 'rgba(255,255,255,0.45)',
  },
});
