import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { COLORS } from '../../utils/colors';
import { generateShopToken } from '../../utils/generateShopToken';

// ─── Shop ID map (match your Firestore shop document IDs) ────────────────────
const SHOP_IDS: Record<string, string> = {
  'REC Cafe': 'rec_cafe',
  'Hut Cafe': 'hut_cafe',
  'REC Mart': 'rec_mart',
  'Dominos': 'dominos',
  'Black Bug Cafe': 'black_bug_cafe',
  'Cafe Coffee Day': 'cafe_coffee_day',
};

type MenuItem = { id: string; name: string; price: number; emoji?: string };

const ALL_ITEMS: MenuItem[] = [
  { id: 'rc1', name: 'Masala Dosa', price: 40, emoji: '🫓' },
  { id: 'rc2', name: 'Idly (3 pcs)', price: 25, emoji: '🍚' },
  { id: 'rc3', name: 'Pongal', price: 35, emoji: '🥣' },
  { id: 'rc4', name: 'Meals (Full)', price: 70, emoji: '🍱' },
  { id: 'rc5', name: 'Curd Rice', price: 30, emoji: '🍚' },
  { id: 'rc6', name: 'Chapati (3 pcs)', price: 35, emoji: '🫓' },
  { id: 'rc7', name: 'Filter Coffee', price: 15, emoji: '☕' },
  { id: 'rc8', name: 'Lemon Juice', price: 20, emoji: '🍋' },
  { id: 'rc9', name: 'Buttermilk', price: 10, emoji: '🥛' },
  { id: 'hc1', name: 'Samosa (2 pcs)', price: 20, emoji: '🔺' },
  { id: 'hc2', name: 'Bread Omelette', price: 35, emoji: '🍳' },
  { id: 'hc3', name: 'Veg Puff', price: 15, emoji: '🥐' },
  { id: 'hc4', name: 'Veg Sandwich', price: 40, emoji: '🥪' },
  { id: 'hc5', name: 'Egg Fried Rice', price: 55, emoji: '🍳' },
  { id: 'hc6', name: 'Maggi Noodles', price: 30, emoji: '🍜' },
  { id: 'hc7', name: 'Chai', price: 10, emoji: '🍵' },
  { id: 'hc8', name: 'Cold Coffee', price: 35, emoji: '🧋' },
  { id: 'hc9', name: 'Mango Lassi', price: 30, emoji: '🥭' },
  { id: 'rm1', name: "Lay's Classic", price: 20, emoji: '🥔' },
  { id: 'rm2', name: 'Kurkure', price: 10, emoji: '🌽' },
  { id: 'rm3', name: 'Biscuit Pack', price: 10, emoji: '🍪' },
  { id: 'rm4', name: 'Nescafé Sachet', price: 5, emoji: '☕' },
  { id: 'rm5', name: 'Cup Noodles', price: 30, emoji: '🍜' },
  { id: 'rm6', name: 'Poha Packet', price: 15, emoji: '🥣' },
  { id: 'rm7', name: 'Water Bottle (1L)', price: 20, emoji: '💧' },
  { id: 'rm8', name: 'Frooti 200ml', price: 15, emoji: '🥭' },
  { id: 'rm9', name: 'Red Bull 250ml', price: 110, emoji: '🐂' },
  { id: 'dm1', name: 'Margherita (M)', price: 149, emoji: '🍕' },
  { id: 'dm2', name: 'Peppy Paneer (M)', price: 199, emoji: '🍕' },
  { id: 'dm3', name: 'Double Cheese (M)', price: 179, emoji: '🍕' },
  { id: 'dm4', name: 'Veg Pasta', price: 99, emoji: '🍝' },
  { id: 'dm5', name: 'Garlic Breadsticks', price: 69, emoji: '🥖' },
  { id: 'dm6', name: 'Stuffed Garlic Bread', price: 99, emoji: '🫓' },
  { id: 'dm7', name: 'Pepsi 250ml', price: 30, emoji: '🥤' },
  { id: 'dm8', name: '7-Up 250ml', price: 30, emoji: '🥤' },
  { id: 'dm9', name: 'Choco Lava Cake', price: 89, emoji: '🍫' },
  { id: 'bb1', name: 'Espresso', price: 60, emoji: '☕' },
  { id: 'bb2', name: 'Cappuccino', price: 90, emoji: '☕' },
  { id: 'bb3', name: 'Cold Brew', price: 110, emoji: '🧊' },
  { id: 'bb4', name: 'Avocado Toast', price: 120, emoji: '🥑' },
  { id: 'bb5', name: 'Club Sandwich', price: 130, emoji: '🥪' },
  { id: 'bb6', name: 'Cheese Quesadilla', price: 110, emoji: '🫓' },
  { id: 'bb7', name: 'Matcha Latte', price: 100, emoji: '🍵' },
  { id: 'bb8', name: 'Oreo Milkshake', price: 120, emoji: '🧋' },
  { id: 'bb9', name: 'Brownie', price: 70, emoji: '🍫' },
];

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', sub: 'GPay / PhonePe / Paytm' },
  { id: 'card', label: 'Card', sub: 'Debit or Credit' },
];

const getCartKey = (id: string) => `student_cart_${id}`;

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart: cartParam, shopName, menuItems: menuItemsParam } = useLocalSearchParams();

  const cart: Record<string, number> = (() => {
    try {
      return JSON.parse((cartParam as string) ?? '{}');
    } catch {
      return {};
    }
  })();
  const shop = shopName as string;

  const menuItems: MenuItem[] = (() => {
    try {
      const parsed = JSON.parse((menuItemsParam as string) ?? '[]');
      return Array.isArray(parsed) ? parsed : ALL_ITEMS;
    } catch {
      return ALL_ITEMS;
    }
  })();

  const cartItems = menuItems.filter(i => cart[i.id] > 0).map(i => ({
    ...i,
    qty: cart[i.id],
    subtotal: cart[i.id] * i.price,
  }));

  const subtotal = cartItems.reduce((s, i) => s + i.subtotal, 0);
  const total = subtotal;

  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [loading, setLoading] = useState(false);

  const handlePlaceOrder = async () => {
    setLoading(true);
    try {
      const userId = getAuth().currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const shopId = SHOP_IDS[shop] ?? shop.toLowerCase().replace(/\s+/g, '_');
      const shopSnap = await getDoc(doc(db, 'shops', shopId));
      const isQueueActive = shopSnap.data()?.isQueueActive ?? false;
      const tokenNumber = isQueueActive ? await generateShopToken(shopId) : null;
      // Save order
      const orderRef = await addDoc(collection(db, 'orders'), {
        userId,
        shopId,
        shopName: shop,
        items: cartItems.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          qty: i.qty,
          subtotal: i.subtotal,
        })),
        subtotal,
        total,
        paymentMethod,
        tokenNumber,
        isTokenAssigned: isQueueActive,
        status: 'pending',
        qrScanned: false,
        createdAt: serverTimestamp(),
      });

      // Deduct stock for each ordered item
      await Promise.all(
        cartItems.map(async (item) => {
          try {
            const menuQuery = query(
              collection(db, 'shops', shopId, 'menu'),
              where('name', '==', item.name)
            );
            const menuSnap = await getDocs(menuQuery);
            if (!menuSnap.empty) {
              const menuDoc = menuSnap.docs[0];
              const currentStock = Number(menuDoc.data().stock ?? 0);
              const newStock = Math.max(0, currentStock - item.qty);
              await updateDoc(doc(db, 'shops', shopId, 'menu', menuDoc.id), {
                stock: newStock,
              });
            }
          } catch (e) {
            // silently fail — don't block order if stock update fails
          }
        })
      );

      await AsyncStorage.removeItem(getCartKey(shopId));

      router.replace({
        pathname: '/student/ebill' as any,
        params: { orderId: orderRef.id },
      } as any);
    } catch (err: any) {
      Alert.alert('Order failed', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Shop pill ── */}
        <View style={styles.shopPill}>
          <Text style={styles.shopPillText}>{shop}</Text>
        </View>

        {/* ── Order summary ── */}
        <Text style={styles.sectionLabel}>Order Summary</Text>
        <View style={styles.card}>
          {cartItems.map((item, idx) => (
            <View
              key={item.id}
              style={[
                styles.orderRow,
                idx < cartItems.length - 1 && styles.orderRowBorder,
              ]}
            >
              <View style={styles.orderLeft}>
                <View>
                  <Text style={styles.orderName}>{item.name}</Text>
                  <Text style={styles.orderQty}>× {item.qty}</Text>
                </View>
              </View>
              <Text style={styles.orderSubtotal}>₹{item.subtotal}</Text>
            </View>
          ))}
        </View>

        {/* ── Bill breakdown ── */}
        <Text style={styles.sectionLabel}>Bill Details</Text>
        <View style={styles.card}>
          <View style={styles.billRow}>
            <Text style={styles.billKey}>Item total</Text>
            <Text style={styles.billVal}>₹{subtotal}</Text>
          </View>
          <View style={[styles.billRow, styles.billTotalRow]}>
            <Text style={styles.billTotalKey}>Total</Text>
            <Text style={styles.billTotalVal}>₹{total}</Text>
          </View>
        </View>

        {/* ── Payment method ── */}
        <Text style={styles.sectionLabel}>Payment Method</Text>
        <View style={styles.paymentGrid}>
          {PAYMENT_METHODS.map(pm => {
            const active = paymentMethod === pm.id;
            return (
              <TouchableOpacity
                key={pm.id}
                style={[styles.payCard, active && styles.payCardActive]}
                onPress={() => setPaymentMethod(pm.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.payLabel, active && styles.payLabelActive]}>
                  {pm.label}
                </Text>
                <Text style={[styles.paySub, active && styles.paySubActive]}>
                  {pm.sub}
                </Text>
                {active && <View style={styles.payCheck}><Text style={styles.payCheckText}>✓</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Place Order button ── */}
      <View style={styles.footer}>
        <View style={styles.footerMeta}>
          <Text style={styles.footerLabel}>To pay</Text>
          <Text style={styles.footerTotal}>₹{total}</Text>
        </View>
        <TouchableOpacity
          style={[styles.placeBtn, loading && { opacity: 0.7 }]}
          onPress={handlePlaceOrder}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.placeBtnText}>Place Order</Text>
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 42,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { fontSize: 28, color: COLORS.background, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.background, letterSpacing: -0.3 },
  scroll: { padding: 16 },
  shopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.highlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
    gap: 6,
  },
  shopPillText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: COLORS.textPrimary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  orderRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  orderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  orderQty: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  orderSubtotal: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  billKey: { fontSize: 14, color: COLORS.textSecondary },
  billVal: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  billTotalRow: {
    borderBottomWidth: 0,
    paddingTop: 13,
  },
  billTotalKey: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  billTotalVal: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  paymentGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  payCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    position: 'relative',
    shadowColor: COLORS.textPrimary,
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  payCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.highlight,
  },
  payLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  payLabelActive: { color: COLORS.primary },
  paySub: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  paySubActive: { color: COLORS.primary },
  payCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payCheckText: { fontSize: 9, color: COLORS.background, fontWeight: '800' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 28,
    gap: 16,
  },
  footerMeta: { flex: 1 },
  footerLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  footerTotal: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginTop: 1 },
  placeBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: COLORS.textPrimary,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  placeBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.background },
});
