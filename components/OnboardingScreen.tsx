import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_KEY = '@JannahGarden:onboardingComplete';
const USER_NAME_KEY = '@JannahGarden:userName';

type OnboardingScreenProps = {
  onComplete: () => void;
};

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateToNext = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleNameSubmit = async () => {
    if (name.trim().length === 0) return;
    await AsyncStorage.setItem(USER_NAME_KEY, name.trim());
    animateToNext(1);
  };

  const handleLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(status === 'granted');
    } catch {
      setLocationGranted(false);
    }
    animateToNext(2);
  };

  const handleSkipLocation = () => {
    setLocationGranted(false);
    animateToNext(2);
  };

  const handleNotificationPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotifGranted(status === 'granted');
    } catch {
      setNotifGranted(false);
    }
    await finishOnboarding();
  };

  const handleSkipNotifications = async () => {
    setNotifGranted(false);
    await finishOnboarding();
  };

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  // Progress dots
  const ProgressDots = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 40 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: i === step ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === step ? '#10b981' : 'rgba(255,255,255,0.2)',
            marginHorizontal: 4,
          }}
        />
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Animated.View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 32,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Step 0: Name */}
            {step === 0 && (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🌳</Text>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: '800',
                    color: '#ffffff',
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  Welcome to{'\n'}Jannah Garden
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    color: 'rgba(255,255,255,0.6)',
                    textAlign: 'center',
                    marginBottom: 32,
                    lineHeight: 22,
                  }}
                >
                  Grow your garden by keeping up{'\n'}with your daily prayers
                </Text>

                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: 'rgba(255,255,255,0.5)',
                    marginBottom: 10,
                    alignSelf: 'flex-start',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  What's your name?
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleNameSubmit}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    borderRadius: 14,
                    paddingHorizontal: 18,
                    paddingVertical: 14,
                    fontSize: 17,
                    color: '#ffffff',
                    marginBottom: 24,
                  }}
                />

                <TouchableOpacity
                  onPress={handleNameSubmit}
                  disabled={name.trim().length === 0}
                  style={{
                    width: '100%',
                    backgroundColor: name.trim().length > 0 ? '#10b981' : 'rgba(16, 185, 129, 0.3)',
                    paddingVertical: 16,
                    borderRadius: 14,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#ffffff',
                      fontSize: 17,
                      fontWeight: '700',
                    }}
                  >
                    Continue
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 1: Location */}
            {step === 1 && (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>📍</Text>
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: '800',
                    color: '#ffffff',
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  Where are you?
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    color: 'rgba(255,255,255,0.6)',
                    textAlign: 'center',
                    marginBottom: 40,
                    lineHeight: 22,
                  }}
                >
                  We need your location to get{'\n'}accurate prayer times for your area
                </Text>

                <TouchableOpacity
                  onPress={handleLocationPermission}
                  style={{
                    width: '100%',
                    backgroundColor: '#10b981',
                    paddingVertical: 16,
                    borderRadius: 14,
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>
                    Allow Location Access
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSkipLocation}
                  style={{
                    width: '100%',
                    paddingVertical: 14,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>
                    Skip for now
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Notifications */}
            {step === 2 && (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🔔</Text>
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: '800',
                    color: '#ffffff',
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  Prayer Reminders
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    color: 'rgba(255,255,255,0.6)',
                    textAlign: 'center',
                    marginBottom: 40,
                    lineHeight: 22,
                  }}
                >
                  Get notified when each prayer{'\n'}time starts so you never miss one
                </Text>

                <TouchableOpacity
                  onPress={handleNotificationPermission}
                  style={{
                    width: '100%',
                    backgroundColor: '#10b981',
                    paddingVertical: 16,
                    borderRadius: 14,
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>
                    Enable Notifications
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSkipNotifications}
                  style={{
                    width: '100%',
                    paddingVertical: 14,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>
                    Maybe later
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          <ProgressDots />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
