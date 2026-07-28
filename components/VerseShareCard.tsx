import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { FONTS } from '../theme/typography';
import { Reflection } from '../data/reflections';
import { Annotation } from '../hooks/useReflections';
import { AnnotationPreview } from './AnnotationEditor';

const ACCENT = '#e8a87c';
const KIND_ACCENT: Record<Reflection['kind'], string> = {
  ayah: '#e8a87c',
  hadith: '#8fbf9f',
};

// Rendered at this width in dp; captureRef grabs it at the device pixel ratio,
// so on a 3x phone the exported PNG is ~1000px wide - plenty for social.
const CARD_W = 340;

export interface ShareableVerse {
  kind: Reflection['kind'];
  arabic?: string;
  translation: string;
  source: string;
  /** The user's own marks, included so a shared card shows their annotation. */
  annotation?: Annotation;
}

/**
 * The card that actually gets exported as an image. Deliberately NOT the same
 * component as the in-app cards: this one is self-contained, branded, and sized
 * for a social feed rather than a scrolling list.
 */
function ShareCard({ verse }: { verse: ShareableVerse }) {
  const kindColor = KIND_ACCENT[verse.kind];
  const [pageW, setPageW] = useState(0);
  const hasMarks = !!verse.annotation && verse.annotation.strokes.length > 0;

  const onVerseLayout = useCallback((e: LayoutChangeEvent) => {
    setPageW(e.nativeEvent.layout.width);
  }, []);

  return (
    <View style={styles.card}>
      <View style={[styles.kindChip, { backgroundColor: kindColor + '22' }]}>
        <Text style={[styles.kindChipText, { color: kindColor }]}>
          {verse.kind === 'ayah' ? "Qur'an" : 'Hadith'}
        </Text>
      </View>

      {/* Verse, with the user's marks overlaid if they annotated it */}
      <View style={styles.verseWrap} onLayout={onVerseLayout}>
        {!!verse.arabic && <Text style={styles.arabic}>{verse.arabic}</Text>}
        <Text style={styles.translation}>{verse.translation}</Text>
        {hasMarks && pageW > 0 && (
          <AnnotationPreview annotation={verse.annotation as Annotation} width={pageW} />
        )}
      </View>

      <Text style={[styles.source, { color: kindColor }]}>{verse.source}</Text>

      <View style={styles.divider} />

      {/* Branding - understated, but enough that the card is traceable */}
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="sprout" size={13} color={ACCENT} />
        </View>
        <Text style={styles.brandName}>Grow Pray</Text>
        <Text style={styles.brandDot}>·</Text>
        <Text style={styles.brandTag}>growpray.com</Text>
      </View>
    </View>
  );
}

/**
 * Renders an off-screen share card on demand, captures it as a PNG, and opens
 * the native share sheet.
 *
 * Usage:
 *   const { shareVerse, shareSurface } = useVerseShare();
 *   ...
 *   {shareSurface}                    // mount once, renders nothing visible
 *   <Button onPress={() => shareVerse(verse)} />
 */
export function useVerseShare() {
  const [pending, setPending] = useState<ShareableVerse | null>(null);
  const [busy, setBusy] = useState(false);
  const shotRef = useRef<View>(null);

  const shareVerse = useCallback(async (verse: ShareableVerse) => {
    if (busy) return;
    setBusy(true);
    setPending(verse);
    try {
      // Let the off-screen card mount and lay out before capturing it.
      await new Promise((r) => setTimeout(r, 90));
      if (!(await Sharing.isAvailableAsync())) return;
      const uri = await captureRef(shotRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share this reflection',
        UTI: 'public.png',
      });
    } catch {
      // Sharing is best-effort - never interrupt the user with an error here.
    } finally {
      setPending(null);
      setBusy(false);
    }
  }, [busy]);

  // Mounted off-screen so it can be captured without ever being visible.
  const shareSurface = pending ? (
    <View style={styles.offscreen} pointerEvents="none">
      <View ref={shotRef} collapsable={false}>
        <ShareCard verse={pending} />
      </View>
    </View>
  ) : null;

  return { shareVerse, shareSurface, sharing: busy };
}

const styles = StyleSheet.create({
  // Parked far off-screen: rendered (so it can be captured) but never seen.
  offscreen: { position: 'absolute', left: -9999, top: 0, opacity: 0 },

  card: {
    width: CARD_W,
    backgroundColor: '#0f1526',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(232,168,124,0.22)',
  },
  kindChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  kindChipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  verseWrap: { position: 'relative' },
  arabic: {
    fontSize: 25,
    color: '#f2e9dc',
    textAlign: 'right',
    lineHeight: 48,
    marginBottom: 16,
    fontFamily: FONTS.arabic,
  },
  translation: {
    fontSize: 15,
    color: 'rgba(242,233,220,0.9)',
    lineHeight: 24,
  },
  source: { fontSize: 12.5, fontWeight: '700', marginTop: 16 },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 18,
    marginBottom: 12,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(232,168,124,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 12.5, fontWeight: '800', color: '#f2e9dc', fontFamily: FONTS.display },
  brandDot: { fontSize: 12, color: 'rgba(242,233,220,0.35)' },
  brandTag: { fontSize: 11.5, color: 'rgba(242,233,220,0.45)' },
});
