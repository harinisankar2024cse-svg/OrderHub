import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/firebaseConfig'

type OrderRecord = {
  id: string
  total?: number
  shopId?: string
  shopName?: string
  status?: string
  createdAt?: any
}

type ShopRecord = {
  id: string
  name?: string
  isQueueActive?: boolean
}

const COLORS = {
  primary: '#7C5CFF',
  background: '#FFFFFF',
  soft: '#F6F4FF',
  border: '#EAE6FF',
  text: '#1A1A1A',
  subText: '#6B6B6B',
  success: '#22C55E',
}

const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`

const normalizeShopValue = (value?: string) =>
  value?.trim().toLowerCase().replace(/\s+/g, ' ')

const isToday = (value: any) => {
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return false

  const now = new Date()
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  )
}

export default function AdminDashboardScreen() {
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [shops, setShops] = useState<ShopRecord[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [loadingShops, setLoadingShops] = useState(true)

  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as OrderRecord[]
      )
      setLoadingOrders(false)
    })

    const unsubShops = onSnapshot(collection(db, 'shops'), (snap) => {
      setShops(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as ShopRecord[]
      )
      setLoadingShops(false)
    })

    return () => {
      unsubOrders()
      unsubShops()
    }
  }, [])

  const completedOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === 'completed' || order.status === 'pending'
      ),
    [orders]
  )

  const totalRevenue = useMemo(
    () =>
      completedOrders.reduce(
        (sum, order) => sum + Number(order.total ?? 0),
        0
      ),
    [completedOrders]
  )

  const revenueByShop = useMemo(() => {
    const shopsById = new Map(shops.map((shop) => [shop.id, shop]))
    const shopsByName = new Map(
      shops
        .filter((shop) => shop.name)
        .map((shop) => [normalizeShopValue(shop.name), shop] as const)
    )
    const revenueMap = new Map<
      string,
      { shopId: string; shopName: string; total: number }
    >()

    shops.forEach((shop) => {
      revenueMap.set(shop.id, {
        shopId: shop.id,
        shopName: shop.name ?? 'Unnamed Shop',
        total: 0,
      })
    })

    completedOrders.forEach((order) => {
      const matchedShop =
        (order.shopId ? shopsById.get(order.shopId) : undefined) ??
        shopsByName.get(normalizeShopValue(order.shopName))

      const resolvedShopId = matchedShop?.id ?? order.shopId ?? 'unknown'
      const current = revenueMap.get(resolvedShopId) ?? {
        shopId: resolvedShopId,
        shopName: matchedShop?.name ?? order.shopName ?? 'Unknown Shop',
        total: 0,
      }

      current.total += Number(order.total ?? 0)
      if (
        !current.shopName ||
        current.shopName === 'Unknown Shop' ||
        current.shopName === 'Unnamed Shop'
      ) {
        current.shopName =
          matchedShop?.name ?? order.shopName ?? current.shopName
      }

      revenueMap.set(resolvedShopId, current)
    })

    return Array.from(revenueMap.values())
      .filter((shop) => shop.total > 0 || shopsById.has(shop.shopId))
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        return a.shopName.localeCompare(b.shopName)
      })
  }, [completedOrders, shops])

  const totalOrdersToday = useMemo(
    () => orders.filter((order) => isToday(order.createdAt)).length,
    [orders]
  )

  const activeQueuesCount = useMemo(
    () => shops.filter((shop) => shop.isQueueActive === true).length,
    [shops]
  )

  const loading = loadingOrders || loadingShops

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total Revenue</Text>
          <Text style={styles.heroValue}>{formatCurrency(totalRevenue)}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Orders Today</Text>
            <Text style={styles.statValue}>{totalOrdersToday}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Active Queues</Text>
            <Text style={styles.statValue}>{activeQueuesCount}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Revenue by Shop</Text>

          {revenueByShop.length === 0 ? (
            <Text style={styles.emptyText}>No shops found</Text>
          ) : (
            revenueByShop.map((shop) => (
              <View key={shop.shopId} style={styles.shopRow}>
                <View>
                  <Text style={styles.shopName}>{shop.shopName}</Text>
                  <Text style={styles.shopMeta}>Shop ID: {shop.shopId}</Text>
                </View>
                <Text style={styles.shopRevenue}>
                  {formatCurrency(shop.total)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: COLORS.background,
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
  },
  heroLabel: {
    color: '#DDD6FE',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  heroValue: {
    color: COLORS.background,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  heroSub: {
    color: '#F5F3FF',
    marginTop: 8,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.soft,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    color: COLORS.subText,
    fontSize: 13,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 10,
  },
  sectionCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  emptyText: {
    color: COLORS.subText,
    fontSize: 14,
  },
  shopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F0FF',
  },
  shopName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  shopMeta: {
    color: COLORS.subText,
    fontSize: 12,
    marginTop: 3,
  },
  shopRevenue: {
    color: COLORS.success,
    fontSize: 15,
    fontWeight: '800',
  },
})
