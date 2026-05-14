import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  StatusBar,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import QRCode from 'react-native-qrcode-svg'
import { db } from '../../firebase/firebaseConfig'

const formatToken = (n: number) => String(n).padStart(4, '0')
const formatPrice = (amount: number) => `\u20B9${Number(amount).toFixed(2)}`

const formatDate = (ts: any) => {
  const date =
    typeof ts === 'object' && ts?.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleString('en-IN')
}

const COLORS = {
  primary: '#7C5CFF',
  background: '#FFFFFF',
  card: '#FFFFFF',
  soft: '#F6F4FF',
  border: '#EAE6FF',
  text: '#1A1A1A',
  subText: '#6B6B6B',
  textMuted: '#A0A0A0',
  success: '#22C55E',
  successSoft: '#E9F9EF',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
}

export default function EBillScreen() {
  const router = useRouter()
  const { orderId } = useLocalSearchParams<{ orderId?: string | string[] }>()

  const safeOrderId =
    typeof orderId === 'string'
      ? orderId
      : Array.isArray(orderId)
      ? orderId[0]
      : undefined

  const [order, setOrder] = useState<any>(null)
  const [shopData, setShopData] = useState<any>(null)
  const [activeToken, setActiveToken] = useState<number | null>(null)
  const [pendingTokens, setPendingTokens] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  const pulse = useRef(new Animated.Value(1)).current
  const readyAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!safeOrderId) return

    const unsub = onSnapshot(doc(db, 'orders', safeOrderId), (snap) => {
      if (snap.exists()) {
        const data = snap.data()

        setOrder({
          orderId: snap.id,
          tokenNumber: data.tokenNumber ?? 0,
          shopName: data.shopName ?? 'OrderHub',
          shopId: data.shopId ?? '',
          items: data.items ?? [],
          total: data.total ?? 0,
          createdAt: data.createdAt ?? new Date(),
          status: data.status ?? 'pending',
          qrScanned: data.qrScanned === true || data.status === 'completed',
        })
      } else {
        setOrder(null)
      }
      setLoading(false)
    })

    return unsub
  }, [safeOrderId])

  useEffect(() => {
    if (!order?.shopId) return

    const unsub = onSnapshot(doc(db, 'shops', order.shopId), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setShopData(data)
        setActiveToken(data.activeToken ?? 0)
      }
    })

    return unsub
  }, [order?.shopId])

  useEffect(() => {
    if (!order?.shopId) {
      setPendingTokens([])
      return
    }

    const q = query(
      collection(db, 'orders'),
      where('shopId', '==', order.shopId)
    )

    const unsub = onSnapshot(q, (snap) => {
      const tokens = snap.docs
        .map((d) => d.data())
        .filter(
          (d) =>
            d.status !== 'completed' &&
            d.tokenNumber !== order.tokenNumber
        )
        .map((d) => d.tokenNumber as number)
        .filter(Boolean)

      setPendingTokens(tokens)
    })

    return unsub
  }, [order?.shopId, order?.tokenNumber])

  const queueActive = shopData?.isQueueActive === true
  const currentActiveToken = activeToken ?? 0

  const isScanned = order?.qrScanned === true
  const isCompletedView = isScanned
  const isReady = order?.status === 'ready'

  const isMyTurn = currentActiveToken === order?.tokenNumber
  const ahead = pendingTokens.filter(
    (t) => t < (order?.tokenNumber ?? 0)
  ).length
  const waitTime = ahead * 3

  const statusText = isScanned
    ? 'Order Completed'
    : isReady
    ? 'Your order is ready'
    : isMyTurn
    ? 'Your Turn!'
    : 'Preparing Order'

  useEffect(() => {
    if (!queueActive || !isMyTurn || isScanned) return

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    )

    loop.start()
    return () => loop.stop()
  }, [queueActive, isMyTurn, isScanned, pulse])

  useEffect(() => {
    if (!isReady || isScanned) {
      readyAnim.setValue(0)
      return
    }

    Animated.spring(readyAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 70,
    }).start()
  }, [isReady, isScanned, readyAnim])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C5CFF" />
      </View>
    )
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text>No order found</Text>
      </View>
    )
  }

  const qrValue = JSON.stringify({
    orderId: order.orderId,
    token: formatToken(order.tokenNumber),
    shopId: order.shopId,
    total: order.total,
  })

  const subtotal = order.items.reduce(
    (sum: number, i: any) => sum + i.price * i.qty,
    0
  )

  const handleShare = async () => {
    await Share.share({
      message:
        `\u{1F9FE} Order Confirmed\n` +
        `Token: #${formatToken(order.tokenNumber)}\n` +
        `Total: ${formatPrice(order.total)}`,
    })
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>{'\u2190'}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Order</Text>

        <TouchableOpacity onPress={handleShare}>
          <Text style={styles.share}>Share</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {!isCompletedView && (
          <>
            {queueActive && (
              <View style={styles.tokenCard}>
                <Text style={styles.tokenLabel}>YOUR TOKEN</Text>

                <Animated.Text
                  style={[
                    styles.token,
                    isMyTurn && { transform: [{ scale: pulse }] },
                  ]}
                >
                  #{formatToken(order.tokenNumber)}
                </Animated.Text>

                <Text style={styles.shop}>{order.shopName}</Text>

                <Text
                  style={[
                    styles.status,
                    isReady ? styles.statusReady : styles.statusPending,
                    isMyTurn && !isReady && styles.statusTurn,
                    isReady && styles.statusReadyLarge,
                  ]}
                >
                  {isReady ? 'READY' : statusText}
                </Text>
              </View>
            )}

            {!queueActive && (
              <View style={styles.walkInCard}>
                <Text style={styles.walkInEmoji}>{'\u{1F9FE}'}</Text>
                <Text style={styles.walkInTitle}>Walk-in Order</Text>
                <Text style={styles.walkInSub}>Show QR at counter</Text>
              </View>
            )}

            {queueActive && !isScanned && (
              <View style={styles.queueInline}>
                <View style={styles.queueRowTop}>
                  <Text style={styles.queueNow}>
                    Serving #{formatToken(currentActiveToken)}
                  </Text>

                  <Text style={styles.queueAhead}>
                    {ahead === 0 ? 'Your turn' : `${ahead} ahead`}
                  </Text>
                </View>

                <View style={styles.progressLine}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.max(5, 100 - ahead * 12)}%`,
                      },
                    ]}
                  />
                </View>

                <Text style={styles.queueWait}>
                  {ahead === 0 ? 'Go to counter' : `~ ${waitTime} min wait`}
                </Text>
              </View>
            )}
          </>
        )}

        <View style={styles.qrCard}>
          <Text style={styles.qrText}>
            {isScanned ? 'QR Completed' : 'Show at counter'}
          </Text>

          {!isScanned && isReady && (
            <Animated.View
              style={[
                styles.readyHero,
                {
                  opacity: readyAnim,
                  transform: [
                    {
                      scale: readyAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.readyIcon}>{'\u{1F389}'}</Text>
              <Text style={styles.readyHeroTitle}>COLLECT NOW!</Text>
              <Text style={styles.readyHeroSub}>Your order is ready</Text>
              <Text style={styles.readyHeroHint}>
                Show the QR code at the counter
              </Text>
            </Animated.View>
          )}

          {isScanned ? (
            <View style={styles.doneWrap}>
              <Text style={styles.tick}>{'\u2713'}</Text>
              <Text style={styles.doneTitle}>Order Completed</Text>
            </View>
          ) : (
            <QRCode value={qrValue} size={180} />
          )}

          <Text style={styles.meta}>{order.orderId}</Text>
          <Text style={styles.meta}>{formatDate(order.createdAt)}</Text>
        </View>

        <View style={styles.summary}>
          <Text style={styles.section}>Summary</Text>

          {order.items.map((i: any, idx: number) => (
            <View key={idx} style={styles.row}>
              <Text>{i.qty}x {i.name}</Text>
              <Text>{formatPrice(i.qty * i.price)}</Text>
            </View>
          ))}

          <View style={styles.row}>
            <Text>Total</Text>
            <Text>{formatPrice(subtotal)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={{ fontWeight: '700' }}>Paid</Text>
            <Text style={{ fontWeight: '700' }}>
              {formatPrice(order.total)}
            </Text>
          </View>
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
    paddingTop: 44,
    paddingHorizontal: 15,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },

  title: { color: '#fff', fontWeight: '700', fontSize: 20 },
  iconBtn: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  back: { color: '#fff', fontSize: 22 },
  share: { color: '#fff', fontWeight: '600' },

  container: { padding: 15, paddingBottom: 24 },

  tokenCard: {
    backgroundColor: COLORS.soft,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  tokenLabel: { color: COLORS.subText, letterSpacing: 1.2, fontSize: 12 },
  token: { fontSize: 40, fontWeight: '800', color: COLORS.primary },
  shop: { color: COLORS.subText, marginTop: 4, fontWeight: '500' },

  status: {
    marginTop: 10,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },

  statusPending: {
    color: COLORS.warning,
    backgroundColor: COLORS.warningSoft,
  },

  statusReady: {
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    fontWeight: '700',
    fontSize: 16,
  },

  statusReadyLarge: {
    fontSize: 18,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },

  statusMuted: {
    color: COLORS.textMuted,
    backgroundColor: '#F3F4F6',
  },

  statusTurn: { fontWeight: '700' },

  walkInCard: {
    backgroundColor: COLORS.soft,
    padding: 24,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  walkInEmoji: { fontSize: 36, marginBottom: 8 },
  walkInTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  walkInSub: {
    fontSize: 13,
    color: COLORS.subText,
    textAlign: 'center',
  },

  queueInline: {
    marginVertical: 22,
  },

  queueRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  queueNow: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  queueAhead: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7C5CFF',
  },

  progressLine: {
    height: 8,
    backgroundColor: '#EAE6FF',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#7C5CFF',
    borderRadius: 10,
  },

  queueWait: {
    fontSize: 16,
    color: '#6B6B6B',
  },

  qrCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: COLORS.card,
  },

  qrText: {
    marginBottom: 10,
    color: COLORS.subText,
    fontWeight: '500',
  },

  readyHero: {
    width: '100%',
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
    borderWidth: 2,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#166534',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  readyIcon: {
    fontSize: 36,
    marginBottom: 6,
  },

  readyHeroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#166534',
    letterSpacing: 1,
    textAlign: 'center',
  },

  readyHeroSub: {
    fontSize: 15,
    fontWeight: '600',
    color: '#15803D',
    marginTop: 6,
  },

  readyHeroHint: {
    fontSize: 13,
    color: '#166534',
    marginTop: 4,
    textAlign: 'center',
  },

  doneWrap: { alignItems: 'center', padding: 20 },
  tick: { fontSize: 40, color: COLORS.success },
  doneTitle: { fontWeight: '700' },
  doneSub: { color: COLORS.subText, fontSize: 12 },

  meta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  summary: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 15,
    backgroundColor: COLORS.card,
  },

  section: {
    fontWeight: '700',
    marginBottom: 10,
    fontSize: 15,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },

  line: { height: 1, backgroundColor: '#ddd', marginVertical: 10 },
})
