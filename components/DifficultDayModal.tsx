import React from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const ICON_MOON = require('../assets/Garden Assets/Icons/Icon_Moon.png');

interface DifficultDayModalProps {
  visible: boolean;
  onClose: () => void;
  onActivate: () => void;
  usesRemaining: number;
  maxUses: number;
  isPremium: boolean;
}

export function DifficultDayModal({
  visible,
  onClose,
  onActivate,
  usesRemaining,
  maxUses,
  isPremium,
}: DifficultDayModalProps) {
  const canActivate = usesRemaining > 0;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <Image source={ICON_MOON} style={{ width: 40, height: 40, marginBottom: 12 }} resizeMode="contain" />

          {/* Title */}
          <Text style={styles.title}>Activate Difficult Day?</Text>

          {/* Description */}
          <Text style={styles.description}>
            Having a tough day? Sick, traveling, or just struggling? 
            Difficult Day mode gives you extra time to pray.
          </Text>

          {/* Benefits */}
          <View style={styles.benefitsBox}>
            <Text style={styles.benefitItem}>  Streaks preserved even on tough days</Text>
            <Text style={styles.benefitItem}>  Auto-deactivates at midnight</Text>
          </View>

          {/* Usage counter */}
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>Uses remaining this month:</Text>
            <Text style={[styles.usageCount, !canActivate && { color: '#ef4444' }]}>
              {usesRemaining}/{maxUses}
            </Text>
          </View>

          {!isPremium && (
            <Text style={styles.premiumHint}>
              Premium users get {10} uses per month
            </Text>
          )}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.activateBtn, !canActivate && styles.disabledBtn]}
              onPress={() => {
                if (!canActivate) return;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onActivate();
              }}
              disabled={!canActivate}
            >
              <Text style={[styles.activateBtnText, !canActivate && { color: '#6b7280' }]}>
                {canActivate ? 'Activate' : 'No Uses Left'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  container: {
    backgroundColor: '#0f1526',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  icon: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    color: '#e8e0d6',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  benefitsBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    gap: 8,
    marginBottom: 16,
  },
  benefitItem: {
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 18,
  },
  highlight: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  warningText: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  usageLabel: {
    color: '#9ca3af',
    fontSize: 13,
  },
  usageCount: {
    color: '#4ade80',
    fontSize: 15,
    fontWeight: '700',
  },
  premiumHint: {
    color: '#6b7280',
    fontSize: 11,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  activateBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e8a87c',
    alignItems: 'center',
  },
  disabledBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  activateBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
