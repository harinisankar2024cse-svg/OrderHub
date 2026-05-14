import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { getAuth } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useRouter } from 'expo-router'
import { db } from '../../firebase/firebaseConfig'

export default function StudentOrders() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const uid = getAuth().currentUser?.uid

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (!uid) {
      setOrders([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const q = query(collection(db, 'orders'), where('userId', '==', uid))
      const snap = await getDocs(q)

      const data = snap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.toDate
            ? a.createdAt.toDate().getTime()
            : new Date(a.createdAt ?? 0).getTime()
          const bTime = b.createdAt?.toDate
            ? b.createdAt.toDate().getTime()
            : new Date(b.createdAt ?? 0).getTime()
          return bTime - aTime
        })

      setOrders(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [uid])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const formatDate = (ts: any) => {
    const date = ts?.toDate ? ts.toDate() : new Date(ts)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('en-IN')
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
        <Text style={styles.title}>Order History</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadOrders(true)}
            colors={['#7C5CFF']}
          />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No orders yet</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() =>
              router.push({
                pathname: '/student/ebill' as any,
                params: { orderId: item.id },
              } as any)
            }
          >
            <View style={styles.cardTop}>
              <Text style={styles.shop}>{item.shopName ?? 'Shop'}</Text>
              <Text
                style={[
                  styles.statusPill,
                  item.status === 'completed' ? styles.statusCompleted : styles.statusPending,
                ]}
              >
                {(item.status ?? 'pending').toUpperCase()}
              </Text>
            </View>

            <Text style={styles.items}>
              {(item.items ?? [])
                .map((i: any) => `${i.qty}x ${i.name}`)
                .join(', ') || 'No items'}
            </Text>

            <View style={styles.row}>
              <Text style={styles.total}>₹{Number(item.total ?? 0).toFixed(2)}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  header: {
    backgroundColor: '#7C5CFF',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },

  listContent: {
    padding: 16,
    paddingBottom: 20,
  },

  emptyText: {
    color: '#999',
    textAlign: 'center',
    marginTop: 18,
  },

  card: {
    borderWidth: 1,
    borderColor: '#EAE6FF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  shop: {
    fontWeight: '700',
    color: '#1A1A1A',
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },

  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },

  statusCompleted: {
    color: '#166534',
    backgroundColor: '#DCFCE7',
  },

  statusPending: {
    color: '#B45309',
    backgroundColor: '#FEF3C7',
  },

  items: { color: '#666', marginVertical: 5 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  total: {
    fontWeight: '700',
    color: '#7C5CFF',
  },

  date: {
    color: '#999',
    fontSize: 12,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
