import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase/firebaseConfig'

type ShopRecord = {
  id: string
  name?: string
}

const COLORS = {
  primary: '#7C5CFF',
  background: '#FFFFFF',
  soft: '#F6F4FF',
  border: '#EAE6FF',
  text: '#1A1A1A',
  subText: '#6B6B6B',
  danger: '#DC2626',
}

export default function AdminProfileScreen() {
  const router = useRouter()
  const [shops, setShops] = useState<ShopRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [resettingShopId, setResettingShopId] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shops'), (snap) => {
      setShops(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as ShopRecord[]
      )
      setLoading(false)
    })

    return unsub
  }, [])

  const resetTokens = async (shop: ShopRecord) => {
    if (resettingShopId) return

    setResettingShopId(shop.id)
    try {
      await updateDoc(doc(db, 'shops', shop.id), {
        activeToken: 0,
        tokenCounter: 0,
      })
      Alert.alert('Success', `${shop.name ?? 'Shop'} tokens reset`)
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to reset tokens')
    } finally {
      setResettingShopId(null)
    }
  }

  const handleSignOut = async () => {
    if (signingOut) return

    setSigningOut(true)
    try {
      await signOut(auth)
      router.replace('/')
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to sign out')
      setSigningOut(false)
    }
  }

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
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {auth.currentUser?.email?.[0]?.toUpperCase() ?? 'A'}
            </Text>
          </View>
          <Text style={styles.emailText}>
            {auth.currentUser?.email ?? 'No email found'}
          </Text>
          <Text style={styles.roleText}>Administrator</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Reset Shop Tokens</Text>

          {shops.length === 0 ? (
            <Text style={styles.emptyText}>No shops found</Text>
          ) : (
            shops.map((shop) => (
              <View key={shop.id} style={styles.shopRow}>
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName}>{shop.name ?? 'Unnamed Shop'}</Text>
                  <Text style={styles.shopId}>Shop ID: {shop.id}</Text>
                </View>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => resetTokens(shop)}
                  disabled={resettingShopId === shop.id}
                >
                  <Text style={styles.resetButtonText}>
                    {resettingShopId === shop.id ? 'Resetting...' : 'Reset Tokens'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>
            {signingOut ? 'Signing Out...' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
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
    paddingBottom: 28,
    gap: 16,
  },
  profileCard: {
    backgroundColor: COLORS.soft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E9E2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  emailText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  roleText: {
    color: COLORS.subText,
    marginTop: 4,
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
    marginBottom: 12,
  },
  emptyText: {
    color: COLORS.subText,
  },
  shopRow: {
    borderTopWidth: 1,
    borderTopColor: '#F3F0FF',
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  shopId: {
    color: COLORS.subText,
    fontSize: 12,
    marginTop: 3,
  },
  resetButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resetButtonText: {
    color: COLORS.background,
    fontWeight: '700',
    fontSize: 13,
  },
  signOutButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
  },
})
