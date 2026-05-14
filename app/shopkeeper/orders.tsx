import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native'

import { getAuth } from 'firebase/auth'
import { db } from '../../firebase/firebaseConfig'

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  updateDoc,
} from 'firebase/firestore'

type OrderItem = {
  id?: string
  name?: string
  qty?: number
  price?: number
}

type OrderRecord = {
  id: string
  shopId?: string
  userId?: string
  status?: string
  tokenNumber?: number | null
  total?: number
  createdAt?: any
  items?: OrderItem[]
}

const formatToken = (n?: number | null) =>
  n ? String(n).padStart(4, '0') : '----'

const formatTime = (ts: any) => {
  const date = ts?.toDate ? ts.toDate() : new Date(ts)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-IN')
}

const toMillis = (ts: any) => {
  const date = ts?.toDate ? ts.toDate() : new Date(ts)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

export default function ShopkeeperOrdersScreen() {
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending')
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [shopId, setShopId] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [readyingOrderId, setReadyingOrderId] = useState<string | null>(null)

  const uid = getAuth().currentUser?.uid

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }

    let unsubOrders: (() => void) | null = null

    const unsubUser = onSnapshot(doc(db, 'users', uid), (userSnap) => {
      const sid = userSnap.data()?.shopId ?? ''
      setShopId(sid)

      if (unsubOrders) unsubOrders()

      if (!sid) {
        setOrders([])
        setLoading(false)
        return
      }

      const q = query(
        collection(db, 'orders'),
        where('shopId', '==', sid),
        orderBy('createdAt', 'asc')
      )

      unsubOrders = onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as OrderRecord[]

        setOrders(list)
        setLoading(false)
      })
    })

    return () => {
      if (unsubOrders) unsubOrders()
      unsubUser()
    }
  }, [uid])

  // ✅ ONLY 2 STATES
  const pendingOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status !== 'completed')
        .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)),
    [orders]
  )

  const completedOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'completed')
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [orders]
  )

  const visibleOrders =
    activeTab === 'pending' ? pendingOrders : completedOrders

  const markAsReady = async (orderId: string) => {
    setReadyingOrderId(orderId)

    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'ready',
      })
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setReadyingOrderId((current) => (current === orderId ? null : current))
    }
  }

  // 🚀 SKIP = MOVE TO BOTTOM (UPDATED createdAt)
  const skipOrder = async (order: OrderRecord) => {
    if (!order.id) return

    try {
      await updateDoc(doc(db, 'orders', order.id), {
        createdAt: serverTimestamp(), // 👈 pushes to bottom
        skippedAt: serverTimestamp(),
      })
    } catch (err: any) {
      Alert.alert('Error', err.message)
    }
  }

  if (!uid) {
    return (
      <View style={styles.center}>
        <Text>Please login</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C5CFF" />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        {['pending', 'completed'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={visibleOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text>No {activeTab} orders</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>
                Token #{formatToken(item.tokenNumber)}
              </Text>

              <Text
                style={{
                  color:
                    item.status === 'completed' || item.status === 'ready'
                      ? '#22C55E'
                      : '#B45309',
                  fontWeight: '600',
                }}
              >
                {item.status === 'completed'
                  ? 'COMPLETED'
                  : item.status === 'ready'
                  ? 'READY'
                  : 'PENDING'}
              </Text>
            </View>

            {item.items?.map((i, idx) => (
              <Text key={idx} style={styles.itemText}>
                {i.qty ?? 0}x {i.name ?? 'Item'}
              </Text>
            ))}

            <View style={styles.metaRow}>
              <Text>Total</Text>
              <Text>₹{Number(item.total ?? 0).toFixed(2)}</Text>
            </View>

            <View style={styles.metaRow}>
              <Text>Time</Text>
              <Text>{formatTime(item.createdAt)}</Text>
            </View>

            {activeTab === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[
                    styles.readyButton,
                    item.status === 'ready' && styles.readyButtonDisabled,
                    readyingOrderId === item.id && styles.readyButtonDisabled,
                  ]}
                  onPress={() => markAsReady(item.id)}
                  disabled={item.status === 'ready' || readyingOrderId === item.id}
                >
                  <Text
                    style={[
                      styles.readyText,
                      item.status === 'ready' && styles.readyTextDisabled,
                    ]}
                  >
                    {item.status === 'ready'
                      ? 'READY \u2714'
                      : readyingOrderId === item.id
                      ? 'Marking...'
                      : 'Mark as Ready'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => skipOrder(item)}
                >
                  <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
    </View>
  )
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: '#7C5CFF',
    paddingTop: 50,
    padding: 16,
  },

  title: { color: '#fff', fontSize: 18, fontWeight: '700' },

  tabsWrap: { flexDirection: 'row', padding: 10, gap: 10 },

  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },

  tabActive: { backgroundColor: '#7C5CFF' },
  tabText: { color: '#666' },
  tabTextActive: { color: '#fff' },

  listContent: { padding: 10 },

  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  cardTitle: { fontWeight: '700' },

  itemText: { color: '#444' },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },

  actions: { marginTop: 10, gap: 10 },

  readyButton: {
    backgroundColor: '#7C5CFF',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },

  readyButtonDisabled: {
    backgroundColor: '#DCFCE7',
  },

  readyText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  readyTextDisabled: {
    color: '#166534',
  },

  skipButton: {
    borderWidth: 1,
    borderColor: '#7C5CFF',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },

  skipText: { color: '#7C5CFF' },

  empty: { alignItems: 'center', marginTop: 40 },
})
