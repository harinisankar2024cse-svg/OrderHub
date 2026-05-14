import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../utils/colors';

// 🔥 FIREBASE
import { db } from '../../firebase/firebaseConfig'; // adjust path if needed
import { collection, onSnapshot } from 'firebase/firestore';

type MenuItem = {
  id: string;
  name: string;
  price: number;
  description?: string;
  image: string;
  stock?: number;
};

const THEME = {
  primary: COLORS.primary,
  background: COLORS.background,
  lightBackground: COLORS.lightBackground,
  white: COLORS.background,
  textDark: COLORS.textPrimary,
  textSecondary: COLORS.textSecondary,
  border: COLORS.border,
  highlight: COLORS.highlight,
};

const getCartKey = (id: string) => `student_cart_${id}`;
const getMenuKey = (id: string) => `student_menu_${id}`;
const LAST_SHOP_KEY = 'student_last_shop_id';

export default function MenuScreen() {
  const router = useRouter();
  const { shopName } = useLocalSearchParams<{ shopName?: string | string[] }>();

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const safeShopName =
    typeof shopName === 'string'
      ? shopName
      : Array.isArray(shopName)
      ? shopName[0]
      : '';

  // 🔥 Convert to Firestore ID
  const shopId = safeShopName?.toLowerCase().replace(/\s+/g, '_');

  // 🔥 REAL-TIME FETCH
  useEffect(() => {
    if (!shopId) return;

    const unsubscribe = onSnapshot(
      collection(db, 'shops', shopId, 'menu'),
      (snapshot) => {
        const items = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((item: any) =>
            typeof item.name === 'string' &&
            item.name.trim().length > 0 &&
            Number.isFinite(Number(item.price)) &&
            Number(item.price) > 0 &&
            item.available !== false
          )
          .map((item: any) => ({
            ...item,
            name: item.name.trim(),
            price: Number(item.price),
          })) as MenuItem[];

        setMenu(items);
      }
    );

    return () => unsubscribe();
  }, [shopId]);

  const syncCartFromStorage = useCallback(async () => {
    if (!shopId) return;
    try {
      const raw = await AsyncStorage.getItem(getCartKey(shopId));
      if (!raw) {
        setCart({});
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setCart(parsed as Record<string, number>);
      } else {
        setCart({});
      }
    } catch {
      // ignore malformed persisted cart
    }
  }, [shopId]);

  useEffect(() => {
    syncCartFromStorage();
  }, [syncCartFromStorage]);

  useFocusEffect(
    useCallback(() => {
      syncCartFromStorage();
    }, [syncCartFromStorage])
  );

  useEffect(() => {
    if (!shopId) return;
    AsyncStorage.setItem(getCartKey(shopId), JSON.stringify(cart));
    AsyncStorage.setItem(getMenuKey(shopId), JSON.stringify(menu));
    AsyncStorage.setItem(LAST_SHOP_KEY, shopId);
  }, [cart, menu, shopId]);

  const filteredMenu = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return menu.filter((item) => {
      return (
        query.length === 0 ||
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    });
  }, [menu, searchQuery]);

  const menuItemById = useMemo(
    () =>
      menu.reduce<Record<string, MenuItem>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [menu]
  );

  const add = (id: string) => {
    setCart((p) => {
      const item = menu.find((m) => m.id === id);
      const maxStock = item?.stock !== undefined ? Number(item.stock) : Infinity;
      const current = p[id] || 0;
      if (current >= maxStock) return p;
      return { ...p, [id]: current + 1 };
    });
  };

  const remove = (id: string) =>
    setCart((p) => {
      const copy = { ...p };
      if (copy[id] === 1) delete copy[id];
      else copy[id]--;
      return copy;
    });

  const { totalItems, totalPrice } = useMemo(
    () =>
      Object.entries(cart).reduce(
        (acc, [id, qty]) => {
          const item = menuItemById[id];
          if (!item) return acc;
          acc.totalItems += qty;
          acc.totalPrice += item.price * qty;
          return acc;
        },
        { totalItems: 0, totalPrice: 0 }
      ),
    [cart, menuItemById]
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{safeShopName}</Text>

        <View style={{ width: 30 }} />
      </View>

      {/* SEARCH */}
      <View style={styles.searchWrap}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search for dishes or drinks"
          placeholderTextColor={THEME.textSecondary}
          style={styles.searchInput}
        />
      </View>

      {/* MENU LIST */}
      <FlatList
        data={filteredMenu}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          totalItems > 0 && styles.listContentWithCartBar,
        ]}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ position: 'relative' }}>
              <Image source={{ uri: item.image }} style={styles.image} />
              {item.stock === 0 && (
                <View style={styles.soldOutBadge}>
                  <Text style={styles.soldOutText}>Sold Out</Text>
                </View>
              )}
            </View>

            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>

              <Text style={styles.desc}>
                {item.description || 'Delicious item'}
              </Text>

              <Text style={styles.price}>₹{item.price}</Text>
            </View>

            <View style={styles.counter}>
              {item.stock === 0 ? (
                <View style={styles.soldOutButton}>
                  <Text style={styles.soldOutButtonText}>Sold Out</Text>
                </View>
              ) : cart[item.id] ? (
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => remove(item.id)}
                  >
                    <Text style={styles.stepperButtonTextDark}>−</Text>
                  </TouchableOpacity>

                  <Text style={styles.qty}>{cart[item.id]}</Text>

                  <TouchableOpacity
                    style={styles.stepperButtonPrimary}
                    onPress={() => add(item.id)}
                  >
                    <Text style={styles.stepperButtonTextLight}>+</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addCircleButton}
                  onPress={() => add(item.id)}
                >
                  <Text style={styles.addCircleText}>+</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {/* CART BAR */}
      {totalItems > 0 && (
        <TouchableOpacity
          style={styles.cartBar}
          onPress={() =>
            router.push({
              pathname: '/student/cart' as any,
              params: {
                shopName: safeShopName,
                cart: JSON.stringify(cart),
                menuItems: JSON.stringify(menu),
              },
            } as any)
          }
        >
          <Text style={styles.cartBarText}>
            {totalItems} items | ₹{totalPrice}
          </Text>

          <View style={styles.viewCartAction}>
            <Text style={styles.cartBarText}>View Cart</Text>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M5 12h14" stroke="white" strokeWidth={2} />
              <Path d="m12 5 7 7-7 7" stroke="white" strokeWidth={2} />
            </Svg>
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.lightBackground,
  },
  listContent: {
    padding: 16,
  },
  listContentWithCartBar: {
    paddingBottom: 96,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 40,
    backgroundColor: THEME.primary,
  },
  back: {
    color: THEME.white,
    fontSize: 24,
  },
  title: {
    color: THEME.white,
    fontSize: 18,
    fontWeight: '700',
  },
  searchWrap: {
    padding: 16,
  },
  searchInput: {
    backgroundColor: THEME.white,
    borderRadius: 10,
    padding: 10,
  },
  card: {
    backgroundColor: THEME.white,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: 140,
    borderRadius: 10,
  },
  soldOutBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  soldOutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  info: {
    marginTop: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  desc: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  price: {
    marginTop: 5,
    color: THEME.primary,
    fontWeight: '600',
  },
  counter: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 2,
  },
  stepperButton: {
    padding: 6,
    backgroundColor: '#eee',
    borderRadius: 6,
    minWidth: 28,
    alignItems: 'center',
  },
  stepperButtonPrimary: {
    padding: 6,
    backgroundColor: THEME.primary,
    borderRadius: 6,
    minWidth: 28,
    alignItems: 'center',
  },
  stepperButtonTextDark: {
    color: '#000',
  },
  stepperButtonTextLight: {
    color: '#fff',
  },
  addCircleButton: {
    borderWidth: 1,
    borderColor: THEME.primary,
    padding: 6,
    borderRadius: 6,
  },
  addCircleText: {
    color: THEME.primary,
  },
  soldOutButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  soldOutButtonText: {
    color: '#999',
    fontWeight: '600',
    fontSize: 12,
  },
  qty: {
    marginHorizontal: 8,
    minWidth: 24,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  cartBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: THEME.primary,
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cartBarText: {
    color: '#fff',
    fontWeight: '700',
  },
  viewCartAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
