import React, { useMemo, useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';

interface SignaturePadProps {
  /** Called whenever the signed state changes (true once at least one stroke exists) */
  onSignedChange?: (signed: boolean) => void;
  height?: number;
  strokeColor?: string;
}

/**
 * A lightweight draw-your-signature pad built on react-native-svg + PanResponder
 * (both already in the project — no extra native deps). Captures finger strokes
 * as SVG paths so the onboarding "pledge" feels like signing a real contract.
 */
export function SignaturePad({ onSignedChange, height = 170, strokeColor = '#e8a87c' }: SignaturePadProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const currentRef = useRef('');
  const signaledRef = useRef(false);

  const markSigned = (signed: boolean) => {
    if (signaledRef.current !== signed) {
      signaledRef.current = signed;
      onSignedChange?.(signed);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          currentRef.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setCurrentPath(currentRef.current);
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          currentRef.current = `${currentRef.current} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setCurrentPath(currentRef.current);
        },
        onPanResponderRelease: () => {
          const completed = currentRef.current;
          currentRef.current = '';
          setCurrentPath('');
          if (completed) {
            setPaths((all) => [...all, completed]);
            markSigned(true);
          }
        },
      }),
    []
  );

  const clear = () => {
    Haptics.selectionAsync();
    currentRef.current = '';
    setPaths([]);
    setCurrentPath('');
    markSigned(false);
  };

  const hasContent = paths.length > 0 || currentPath.length > 0;

  return (
    <View>
      <View style={[styles.pad, { height }]} {...panResponder.panHandlers}>
        <Svg width="100%" height="100%">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke={strokeColor} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {currentPath ? (
            <Path d={currentPath} stroke={strokeColor} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>

        {/* Signature line + hint, shown until the user starts drawing */}
        {!hasContent && (
          <View style={styles.placeholderWrap} pointerEvents="none">
            <Text style={styles.placeholderText}>Sign here with your finger</Text>
          </View>
        )}
        <View style={styles.signLine} pointerEvents="none" />
        <Text style={styles.signX} pointerEvents="none">✕</Text>
      </View>

      {hasContent && (
        <TouchableOpacity onPress={clear} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  placeholderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: 'rgba(247,241,232,0.30)',
    fontSize: 14,
    fontFamily: FONTS.displayMedium,
  },
  signLine: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 34,
    height: 1,
    backgroundColor: 'rgba(247,241,232,0.25)',
  },
  signX: {
    position: 'absolute',
    left: 24,
    bottom: 38,
    color: 'rgba(247,241,232,0.35)',
    fontSize: 14,
  },
  clearBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  clearText: {
    color: 'rgba(247,241,232,0.5)',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
