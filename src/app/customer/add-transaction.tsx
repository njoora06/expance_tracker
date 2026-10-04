import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { PickerModal } from '@/components/ui/PickerModal';
import { addTransaction } from '@/store/storage';
import { PAYMENT_METHODS, PaymentMethod, TransactionType } from '@/store/types';
import { formatAmount } from '@/utils/helpers';
import { useSettings } from '@/hooks/use-settings';
import { notify } from '@/utils/notify';

export default function AddTransactionScreen() {
  const { customerId, customerName } = useLocalSearchParams<{ customerId: string; customerName: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { currency } = useSettings();

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('credit');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!amount.trim()) errs.amount = 'Amount is required';
    else if (isNaN(Number(amount)) || Number(amount) <= 0) errs.amount = 'Enter a valid amount';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [amount]);

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await addTransaction({
        customerId: customerId!,
        amount: Number(amount),
        type,
        date: date.toISOString(),
        time: time.toISOString(),
        paymentMethod,
        notes: notes.trim(),
      }, user!.id);
      notify.success(
        'Transaction added',
        `${type === 'credit' ? '+' : '-'}${formatAmount(Number(amount), currency)} ${type}${customerName ? ` for ${customerName}` : ''}`
      );
      router.back();
    } catch (e) {
      notify.error("Couldn't save transaction");
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const onTimeChange = (_: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) setTime(selectedTime);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: `Add Transaction`,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['bottom']}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={[styles.customerLabel, { color: theme.textSecondary }]}>Customer</Text>
          <Text style={[styles.customerName, { color: theme.text }]}>
            {customerName ? decodeURIComponent(customerName) : ''}
          </Text>

          {/* Credit / Debit Toggle */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Transaction Type</Text>
            <View style={styles.typeToggle}>
              <Pressable
                style={[
                  styles.typeBtn,
                  { backgroundColor: theme.backgroundElement },
                  type === 'credit' && { backgroundColor: '#4ECDC4' },
                ]}
                onPress={() => setType('credit')}
              >
                <Text style={[styles.typeBtnText, { color: theme.text }, type === 'credit' && { color: '#fff' }]}>
                  Credit (I Gave)
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.typeBtn,
                  { backgroundColor: theme.backgroundElement },
                  type === 'debit' && { backgroundColor: '#FF6B6B' },
                ]}
                onPress={() => setType('debit')}
              >
                <Text style={[styles.typeBtnText, { color: theme.text }, type === 'debit' && { color: '#fff' }]}>
                  Debit (I Received)
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Amount */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Amount *</Text>
            <View style={[styles.amountInputWrap, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.currencySign, { color: theme.text }]}>
                {currency === 'INR' ? '₹' : '$'}
              </Text>
              <TextInput
                style={[styles.amountInput, { color: theme.text }]}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                value={amount}
                onChangeText={(v) => { setAmount(v); setErrors((e) => ({ ...e, amount: '' })); }}
                keyboardType="decimal-pad"
              />
            </View>
            {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
          </View>

          {/* Date */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Date</Text>
            <Pressable
              style={[styles.pickerBtn, { backgroundColor: theme.backgroundElement }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.pickerBtnText, { color: theme.text }]}>
                {date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </Pressable>
            {showDatePicker && <DateTimePicker value={date} mode="date" onChange={onDateChange} />}
          </View>

          {/* Time */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Time</Text>
            <Pressable
              style={[styles.pickerBtn, { backgroundColor: theme.backgroundElement }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={[styles.pickerBtnText, { color: theme.text }]}>
                {time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
            {showTimePicker && <DateTimePicker value={time} mode="time" onChange={onTimeChange} />}
          </View>

          {/* Payment Method */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Payment Method</Text>
            <Pressable
              style={[styles.pickerBtn, { backgroundColor: theme.backgroundElement }]}
              onPress={() => setShowPaymentPicker(true)}
            >
              <Text style={[styles.pickerBtnText, { color: theme.text }]}>{paymentMethod}</Text>
            </Pressable>
          </View>

          {/* Notes */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Description / Notes</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }, styles.multilineInput]}
              placeholder="e.g., Payment for supplies"
              placeholderTextColor={theme.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Preview */}
          <View style={[styles.preview, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>
              {type === 'credit' ? 'You gave (Credit)' : 'You received (Debit)'}
            </Text>
            <Text style={[styles.previewAmount, { color: type === 'credit' ? '#4ECDC4' : '#FF6B6B' }]}>
              {type === 'credit' ? '+' : '-'}{formatAmount(Number(amount) || 0, currency)}
            </Text>
            <Text style={[styles.previewMeta, { color: theme.textSecondary }]}>
              {paymentMethod}
            </Text>
          </View>

          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Transaction'}</Text>
          </Pressable>
        </ScrollView>

        <PickerModal
          visible={showPaymentPicker}
          title="Select Payment Method"
          options={PAYMENT_METHODS.map((m) => ({ label: m, value: m }))}
          selected={paymentMethod}
          onSelect={(v) => setPaymentMethod(v as PaymentMethod)}
          onClose={() => setShowPaymentPicker(false)}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  customerLabel: { fontSize: 13, marginBottom: 2 },
  customerName: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  typeToggle: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  typeBtnText: { fontSize: 14, fontWeight: '700' },
  input: { padding: 16, borderRadius: 12, fontSize: 16 },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { color: '#FF6B6B', fontSize: 12, marginTop: 4 },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySign: { fontSize: 20, fontWeight: '700', marginRight: 8 },
  amountInput: { flex: 1, padding: 16, fontSize: 18, fontWeight: '700' },
  pickerBtn: { padding: 16, borderRadius: 12 },
  pickerBtnText: { fontSize: 16 },
  preview: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  previewLabel: { fontSize: 12, marginBottom: 8 },
  previewAmount: { fontSize: 32, fontWeight: '800', marginBottom: 4 },
  previewMeta: { fontSize: 14 },
  saveBtn: { backgroundColor: '#208AEF', padding: 18, borderRadius: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
