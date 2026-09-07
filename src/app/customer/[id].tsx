import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/hooks/use-settings';
import { useAuth } from '@/hooks/use-auth';
import { onDataRefresh } from '@/store/dataRefresh';
import {
  getCustomerById,
  getCustomerTotals,
  getTransactions,
  updateCustomer,
  deleteCustomer,
  deleteTransaction,
  updateTransaction,
} from '@/store/storage';
import { Customer, CustomerTransaction, PAYMENT_METHODS, PaymentMethod, TransactionType } from '@/store/types';
import { formatAmount, formatDate, formatTime } from '@/utils/helpers';
import { exportCustomerLedger } from '@/utils/export';
import { EmptyState } from '@/components/ui/EmptyState';
import { PickerModal } from '@/components/ui/PickerModal';

export default function CustomerLedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { currency } = useSettings();
  const { user } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [totals, setTotals] = useState({ totalCredit: 0, totalDebit: 0, balance: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Transaction edit state
  const [editingTxn, setEditingTxn] = useState<CustomerTransaction | null>(null);
  const [txnAmount, setTxnAmount] = useState('');
  const [txnType, setTxnType] = useState<TransactionType>('credit');
  const [txnDate, setTxnDate] = useState(new Date());
  const [txnTime, setTxnTime] = useState(new Date());
  const [txnPaymentMethod, setTxnPaymentMethod] = useState<PaymentMethod>('Cash');
  const [txnNotes, setTxnNotes] = useState('');
  const [showTxnDatePicker, setShowTxnDatePicker] = useState(false);
  const [showTxnTimePicker, setShowTxnTimePicker] = useState(false);
  const [showTxnPaymentPicker, setShowTxnPaymentPicker] = useState(false);
  const [txnErrors, setTxnErrors] = useState<Record<string, string>>({});

  const userId = user?.id || '';

  const loadData = async () => {
    if (!id || !userId) return;
    const c = await getCustomerById(id, userId);
    const t = await getCustomerTotals(id, userId);
    const txns = await getTransactions(id, userId);
    setCustomer(c);
    setTotals(t);
    setTransactions(txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    if (c) {
      setEditName(c.name);
      setEditMobile(c.mobile);
      setEditEmail(c.email);
      setEditAddress(c.address);
      setEditNotes(c.notes);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    const unsub = onDataRefresh(() => loadData());
    return unsub;
  }, [loadData]);

  const handleSaveEdit = async () => {
    if (!editName.trim()) { Alert.alert('Validation', 'Customer name is required'); return; }
    try {
      await updateCustomer(id!, {
        name: editName.trim(),
        mobile: editMobile.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
      }, userId);
      Alert.alert('Updated', 'Customer updated successfully', [
        { text: 'OK', onPress: () => { setIsEditing(false); loadData(); } },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to update customer');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Customer', `Delete "${customer?.name}" and all their transactions?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteCustomer(id!, userId);
          router.back();
        },
      },
    ]);
  };

  const handleExport = async () => {
    if (!customer) return;
    const success = await exportCustomerLedger(customer, transactions, currency);
    if (success) {
      Alert.alert('Exported', 'Ledger exported successfully');
    } else {
      Alert.alert('Error', 'Failed to export');
    }
  };

  const handleEditTxnPress = (txn: CustomerTransaction) => {
    setEditingTxn(txn);
    setTxnAmount(String(txn.amount));
    setTxnType(txn.type);
    setTxnDate(new Date(txn.date));
    setTxnTime(new Date(txn.time));
    setTxnPaymentMethod(txn.paymentMethod as PaymentMethod);
    setTxnNotes(txn.notes);
    setTxnErrors({});
  };

  const handleSaveTxnEdit = async () => {
    if (!editingTxn) return;
    const errs: Record<string, string> = {};
    if (!txnAmount.trim()) errs.amount = 'Amount is required';
    else if (isNaN(Number(txnAmount)) || Number(txnAmount) <= 0) errs.amount = 'Enter a valid amount';
    setTxnErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await updateTransaction(
        editingTxn.id,
        editingTxn.customerId,
        {
          amount: Number(txnAmount),
          type: txnType,
          date: txnDate.toISOString(),
          time: txnTime.toISOString(),
          paymentMethod: txnPaymentMethod,
          notes: txnNotes.trim(),
        },
        userId
      );
      setEditingTxn(null);
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to update transaction');
    }
  };

  const handleDeleteTxnPress = (txn: CustomerTransaction) => {
    Alert.alert('Delete Transaction', `Delete this ${txn.type} of ${formatAmount(txn.amount, currency)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction(txn.id, txn.customerId, userId);
            loadData();
          } catch {
            Alert.alert('Error', 'Failed to delete transaction');
          }
        },
      },
    ]);
  };

  if (!customer) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: isEditing ? 'Edit Customer' : customer.name,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerRight: () =>
            !isEditing ? (
              <View style={{ flexDirection: 'row', gap: 8, marginRight: 8 }}>
                <Pressable onPress={() => setIsEditing(true)}>
                  <Text style={{ color: '#208AEF', fontSize: 15, fontWeight: '600' }}>Edit</Text>
                </Pressable>
                <Pressable onPress={handleDelete}>
                  <Text style={{ color: '#FF6B6B', fontSize: 15, fontWeight: '600' }}>Del</Text>
                </Pressable>
              </View>
            ) : null,
        }}
      />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['bottom']}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {isEditing ? (
            <>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Name *</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]} value={editName} onChangeText={setEditName} />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Mobile</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]} value={editMobile} onChangeText={setEditMobile} keyboardType="phone-pad" />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Address</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }, { minHeight: 60, textAlignVertical: 'top' }]} value={editAddress} onChangeText={setEditAddress} multiline />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Notes</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }, { minHeight: 60, textAlignVertical: 'top' }]} value={editNotes} onChangeText={setEditNotes} multiline />
              </View>
              <Pressable style={styles.saveBtn} onPress={handleSaveEdit}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </Pressable>
              <Pressable style={[styles.cancelBtn, { borderColor: theme.backgroundElement }]} onPress={() => { setIsEditing(false); loadData(); }}>
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={[styles.balanceSection, { backgroundColor: totals.balance >= 0 ? '#4ECDC420' : '#FF6B6B20' }]}>
                <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>
                  {totals.balance >= 0 ? 'Receivable (They Owe You)' : 'Payable (You Owe Them)'}
                </Text>
                <Text style={[styles.balanceValue, { color: totals.balance >= 0 ? '#4ECDC4' : '#FF6B6B' }]}>
                  {formatAmount(Math.abs(totals.balance), currency)}
                </Text>
                {customer.mobile ? (
                  <Text style={[styles.customerMeta, { color: theme.textSecondary }]}>{customer.mobile}</Text>
                ) : null}
                {customer.email ? (
                  <Text style={[styles.customerMeta, { color: theme.textSecondary }]}>{customer.email}</Text>
                ) : null}
              </View>

              <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Credit</Text>
                  <Text style={[styles.statValue, { color: '#4ECDC4' }]}>{formatAmount(totals.totalCredit, currency)}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Debit</Text>
                  <Text style={[styles.statValue, { color: '#FF6B6B' }]}>{formatAmount(totals.totalDebit, currency)}</Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: '#208AEF' }]}
                  onPress={() => router.push(`/customer/add-transaction?customerId=${customer.id}&customerName=${encodeURIComponent(customer.name)}`)}
                >
                  <Text style={styles.actionBtnText}>+ Add Transaction</Text>
                </Pressable>
                <Pressable
                  style={[styles.exportBtn, { backgroundColor: theme.backgroundElement }]}
                  onPress={handleExport}
                >
                  <Text style={[styles.exportBtnText, { color: theme.text }]}>Export</Text>
                </Pressable>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.text }]}>Transaction History</Text>

              {transactions.length === 0 ? (
                <EmptyState title="No transactions" subtitle="Add the first transaction for this customer" />
              ) : (
                transactions.map((txn) => (
                  <View key={txn.id} style={[styles.txnCard, { backgroundColor: theme.backgroundElement }]}>
                    <View style={styles.txnHeader}>
                      <View style={[styles.txnType, { backgroundColor: txn.type === 'credit' ? '#4ECDC420' : '#FF6B6B20' }]}>
                        <Text style={{ color: txn.type === 'credit' ? '#4ECDC4' : '#FF6B6B', fontSize: 12, fontWeight: '700' }}>
                          {txn.type === 'credit' ? 'CREDIT' : 'DEBIT'}
                        </Text>
                      </View>
                      <Text style={[styles.txnAmount, { color: txn.type === 'credit' ? '#4ECDC4' : '#FF6B6B' }]}>
                        {txn.type === 'credit' ? '+' : '-'}{formatAmount(txn.amount, currency)}
                      </Text>
                    </View>
                    <View style={styles.txnBody}>
                      <Text style={[styles.txnDate, { color: theme.textSecondary }]}>
                        {formatDate(txn.date)} at {formatTime(txn.time)} • {txn.paymentMethod}
                      </Text>
                      {txn.notes ? <Text style={[styles.txnNotes, { color: theme.textSecondary }]}>{txn.notes}</Text> : null}
                      <Text style={[styles.txnRunningBalance, { color: theme.text }]}>
                        Running Balance: {formatAmount(txn.runningBalance, currency)}
                      </Text>
                    </View>
                    <View style={[styles.txnActions, { borderTopColor: theme.background }]}>
                      <Pressable style={styles.txnActionBtn} onPress={() => handleEditTxnPress(txn)}>
                        <Text style={[styles.txnActionText, { color: '#208AEF' }]}>Edit</Text>
                      </Pressable>
                      <Pressable style={styles.txnActionBtn} onPress={() => handleDeleteTxnPress(txn)}>
                        <Text style={[styles.txnActionText, { color: '#FF6B6B' }]}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Edit Transaction Modal */}
      <Modal visible={!!editingTxn} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
          <Stack.Screen
            options={{
              headerShown: true,
              headerTitle: 'Edit Transaction',
              headerStyle: { backgroundColor: theme.background },
              headerTintColor: theme.text,
              headerLeft: () => (
                <Pressable onPress={() => setEditingTxn(null)}>
                  <Text style={{ color: '#208AEF', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
              ),
              headerRight: () => (
                <Pressable onPress={handleSaveTxnEdit}>
                  <Text style={{ color: '#208AEF', fontSize: 15, fontWeight: '600' }}>Save</Text>
                </Pressable>
              ),
            }}
          />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {/* Transaction Type Toggle */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Transaction Type</Text>
              <View style={styles.typeToggle}>
                <Pressable
                  style={[
                    styles.typeBtn,
                    { backgroundColor: theme.backgroundElement },
                    txnType === 'credit' && { backgroundColor: '#4ECDC4' },
                  ]}
                  onPress={() => setTxnType('credit')}
                >
                  <Text style={[styles.typeBtnText, { color: theme.text }, txnType === 'credit' && { color: '#fff' }]}>
                    Credit (I Gave)
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.typeBtn,
                    { backgroundColor: theme.backgroundElement },
                    txnType === 'debit' && { backgroundColor: '#FF6B6B' },
                  ]}
                  onPress={() => setTxnType('debit')}
                >
                  <Text style={[styles.typeBtnText, { color: theme.text }, txnType === 'debit' && { color: '#fff' }]}>
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
                  value={txnAmount}
                  onChangeText={(v) => { setTxnAmount(v); setTxnErrors((e) => ({ ...e, amount: '' })); }}
                  keyboardType="decimal-pad"
                />
              </View>
              {txnErrors.amount && <Text style={styles.errorText}>{txnErrors.amount}</Text>}
            </View>

            {/* Date */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Date</Text>
              <Pressable
                style={[styles.pickerBtn, { backgroundColor: theme.backgroundElement }]}
                onPress={() => setShowTxnDatePicker(true)}
              >
                <Text style={[styles.pickerBtnText, { color: theme.text }]}>
                  {txnDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </Pressable>
              {showTxnDatePicker && (
                <DateTimePicker
                  value={txnDate}
                  mode="date"
                  onChange={(_: DateTimePickerEvent, d?: Date) => {
                    setShowTxnDatePicker(Platform.OS === 'ios');
                    if (d) setTxnDate(d);
                  }}
                />
              )}
            </View>

            {/* Time */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Time</Text>
              <Pressable
                style={[styles.pickerBtn, { backgroundColor: theme.backgroundElement }]}
                onPress={() => setShowTxnTimePicker(true)}
              >
                <Text style={[styles.pickerBtnText, { color: theme.text }]}>
                  {txnTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Pressable>
              {showTxnTimePicker && (
                <DateTimePicker
                  value={txnTime}
                  mode="time"
                  onChange={(_: DateTimePickerEvent, d?: Date) => {
                    setShowTxnTimePicker(Platform.OS === 'ios');
                    if (d) setTxnTime(d);
                  }}
                />
              )}
            </View>

            {/* Payment Method */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Payment Method</Text>
              <Pressable
                style={[styles.pickerBtn, { backgroundColor: theme.backgroundElement }]}
                onPress={() => setShowTxnPaymentPicker(true)}
              >
                <Text style={[styles.pickerBtnText, { color: theme.text }]}>{txnPaymentMethod}</Text>
              </Pressable>
            </View>

            {/* Notes */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Description / Notes</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="e.g., Payment for supplies"
                placeholderTextColor={theme.textSecondary}
                value={txnNotes}
                onChangeText={setTxnNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Preview */}
            <View style={[styles.preview, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>
                {txnType === 'credit' ? 'You gave (Credit)' : 'You received (Debit)'}
              </Text>
              <Text style={[styles.previewAmount, { color: txnType === 'credit' ? '#4ECDC4' : '#FF6B6B' }]}>
                {txnType === 'credit' ? '+' : '-'}{formatAmount(Number(txnAmount) || 0, currency)}
              </Text>
              <Text style={[styles.previewMeta, { color: theme.textSecondary }]}>
                {txnPaymentMethod}
              </Text>
            </View>

            <Pressable style={styles.saveBtn} onPress={handleSaveTxnEdit}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </Pressable>
            <Pressable style={[styles.cancelBtn, { borderColor: theme.backgroundElement }]} onPress={() => setEditingTxn(null)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
          </ScrollView>

          <PickerModal
            visible={showTxnPaymentPicker}
            title="Select Payment Method"
            options={PAYMENT_METHODS.map((m) => ({ label: m, value: m }))}
            selected={txnPaymentMethod}
            onSelect={(v) => setTxnPaymentMethod(v as PaymentMethod)}
            onClose={() => setShowTxnPaymentPicker(false)}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  balanceSection: { alignItems: 'center', padding: 24, borderRadius: 16, marginBottom: 16 },
  balanceLabel: { fontSize: 14, marginBottom: 4 },
  balanceValue: { fontSize: 36, fontWeight: '800', marginBottom: 8 },
  customerMeta: { fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center' },
  statLabel: { fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  exportBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, justifyContent: 'center' },
  exportBtnText: { fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  txnCard: { padding: 14, borderRadius: 12, marginBottom: 8 },
  txnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  txnType: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  txnAmount: { fontSize: 18, fontWeight: '700' },
  txnBody: {},
  txnDate: { fontSize: 12 },
  txnNotes: { fontSize: 13, marginTop: 4 },
  txnRunningBalance: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  txnActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  txnActionBtn: { paddingVertical: 2 },
  txnActionText: { fontSize: 13, fontWeight: '600' },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { padding: 16, borderRadius: 12, fontSize: 16 },
  saveBtn: { backgroundColor: '#208AEF', padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelBtn: { padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 8, borderWidth: 1 },
  cancelBtnText: { fontSize: 16 },
  typeToggle: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  typeBtnText: { fontSize: 14, fontWeight: '700' },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySign: { fontSize: 20, fontWeight: '700', marginRight: 8 },
  amountInput: { flex: 1, padding: 16, fontSize: 18, fontWeight: '700' },
  errorText: { color: '#FF6B6B', fontSize: 12, marginTop: 4 },
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
});
