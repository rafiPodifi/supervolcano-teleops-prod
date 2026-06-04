/**
 * LOCATION CARD
 * Shared assigned-location card (LocationsScreen home + AllLocationsScreen).
 * Staggered entrance + press scale, optional distance chip.
 *
 * (Replaces an older unused task-progress card that nothing imported.)
 */

import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Home, Video, Navigation } from "lucide-react-native";
import type { Location } from "@/types";

export function LocationCard({
  location,
  onPress,
  index,
  distanceLabel,
}: {
  location: Location;
  onPress: () => void;
  index: number;
  distanceLabel?: string;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Staggered entrance animation
  useEffect(() => {
    const delay = index * 60;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        paddingHorizontal: 20,
        opacity: fadeAnim,
        transform: [{ translateY }, { scale: scaleAnim }],
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {/* Left icon */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: "#EFF6FF",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Home size={24} color="#3B82F6" />
        </View>

        {/* Middle content */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#111827",
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {location.name}
          </Text>
          {location.address ? (
            <Text style={{ fontSize: 14, color: "#6B7280" }} numberOfLines={1}>
              {location.address}
            </Text>
          ) : (
            <Text
              style={{ fontSize: 14, color: "#9CA3AF", fontStyle: "italic" }}
            >
              No address
            </Text>
          )}
          {distanceLabel ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                backgroundColor: "#EFF6FF",
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 3,
                marginTop: 6,
              }}
            >
              <Navigation size={11} color="#3B82F6" />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#3B82F6",
                  marginLeft: 4,
                }}
              >
                {distanceLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Right camera icon */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "#EFF6FF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Video size={20} color="#3B82F6" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
