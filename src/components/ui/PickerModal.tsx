import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

interface PickerOption {
  label: string;
  value: string;
}

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: PickerModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.container, { backgroundColor: theme.background }]}
          onPress={() => {}}
        >
          <View style={styles.dragIndicator} />

          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

          <ScrollView style={styles.optionsList}>
            {options.map((opt) => {
              const isSelected = opt.value === selected;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.option,
                    { backgroundColor: theme.backgroundElement },
                    isSelected && { backgroundColor: theme.backgroundSelected },
                  ]}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: theme.text },
                      isSelected && { color: '#208AEF', fontWeight: '700' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <SymbolView
                      name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                      size={22}
                      weight="bold"
                      tintColor="#208AEF"
                    />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.two,
    paddingBottom: 40,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 16,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C6C8CC',
    alignSelf: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 24,
    marginBottom: Spacing.three,
  },
  optionsList: {
    paddingHorizontal: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: Spacing.two,
    backgroundColor: '#208AEF',
    borderRadius: 14,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
