import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase/firebaseConfig'

type ShopRecord = {
  id: string
  name?: string
}

type MenuItemRecord = {
  id: string
  name?: string
  price?: number
  description?: string
  image?: string
  stock?: number
}

const COLORS = {
  primary: '#7C5CFF',
  background: '#FFFFFF',
  soft: '#F6F4FF',
  border: '#EAE6FF',
  text: '#1A1A1A',
  subText: '#6B6B6B',
  danger: '#DC2626',
  warningSoft: '#FEF3C7',
}

const emptyForm = {
  name: '',
  price: '',
  description: '',
  stock: '',
  image: '',
}

export default function AdminStockScreen() {
  const [shops, setShops] = useState<ShopRecord[]>([])
  const [selectedShop, setSelectedShop] = useState<ShopRecord | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItemRecord[]>([])
  const [loadingShops, setLoadingShops] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shops'), (snap) => {
      setShops(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as ShopRecord[]
      )
      setLoadingShops(false)
    })

    return unsub
  }, [])

  useEffect(() => {
    if (!selectedShop?.id) {
      setMenuItems([])
      setLoadingItems(false)
      return
    }

    setLoadingItems(true)

    const unsub = onSnapshot(
      query(collection(db, 'shops', selectedShop.id, 'menu'), orderBy('name')),
      (snap) => {
        setMenuItems(
          snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as MenuItemRecord[]
        )
        setLoadingItems(false)
      }
    )

    return unsub
  }, [selectedShop?.id])

  const updateStock = async (item: MenuItemRecord, delta: number) => {
    if (!selectedShop?.id) return

    const nextStock = Math.max(0, Number(item.stock ?? 0) + delta)
    try {
      await updateDoc(doc(db, 'shops', selectedShop.id, 'menu', item.id), {
        stock: nextStock,
      })
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to update stock')
    }
  }

  const removeItem = async (itemId: string) => {
    if (!selectedShop?.id) return

    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'shops', selectedShop.id!, 'menu', itemId))
          } catch (err: any) {
            Alert.alert('Error', err.message ?? 'Failed to delete item')
          }
        },
      },
    ])
  }

  const addItem = async () => {
    if (!selectedShop?.id || saving) return

    const trimmedName = form.name.trim()
    const trimmedDescription = form.description.trim()
    const trimmedImage = form.image.trim()
    const price = Number(form.price)
    const stock = Number(form.stock)

    if (!trimmedName) {
      Alert.alert('Missing Name', 'Enter an item name.')
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Invalid Price', 'Enter a valid price.')
      return
    }

    if (!Number.isFinite(stock) || stock < 0) {
      Alert.alert('Invalid Stock', 'Enter a valid stock quantity.')
      return
    }

    setSaving(true)
    try {
      await addDoc(collection(db, 'shops', selectedShop.id, 'menu'), {
        name: trimmedName,
        price,
        description: trimmedDescription,
        stock,
        image: trimmedImage,
      })
      setForm(emptyForm)
      setShowAddModal(false)
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  const renderShopItem = ({ item }: { item: ShopRecord }) => (
    <TouchableOpacity
      style={styles.shopCard}
      onPress={() => {
        setSelectedShop(item)
        setForm(emptyForm)
      }}
    >
      <Text style={styles.shopCardTitle}>{item.name ?? 'Unnamed Shop'}</Text>
    </TouchableOpacity>
  )

  const renderMenuItem = ({ item }: { item: MenuItemRecord }) => {
    const stock = Number(item.stock ?? 0)
    const outOfStock = stock === 0

    return (
      <View style={styles.menuCard}>
        <View style={styles.menuTop}>
          <View style={styles.menuTopLeft}>
            <Text style={styles.menuName}>{item.name ?? 'Unnamed Item'}</Text>
            <Text style={styles.menuPrice}>₹{Number(item.price ?? 0).toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => removeItem(item.id)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>

        {!!item.description && (
          <Text style={styles.menuDescription}>{item.description}</Text>
        )}

        <View style={styles.stockRow}>
          <Text style={styles.stockLabel}>Stock</Text>
          <View style={styles.stockControls}>
            <TouchableOpacity
              style={styles.stockButton}
              onPress={() => updateStock(item, -1)}
            >
              <Text style={styles.stockButtonText}>-</Text>
            </TouchableOpacity>
            <View
              style={[
                styles.stockValueWrap,
                outOfStock && styles.stockValueWrapDanger,
              ]}
            >
              <Text
                style={[
                  styles.stockValue,
                  outOfStock && styles.stockValueDanger,
                ]}
              >
                {outOfStock ? 'Out of stock' : `${stock} available`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.stockButton}
              onPress={() => updateStock(item, 1)}
            >
              <Text style={styles.stockButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  if (loadingShops) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stock</Text>
        <Text style={styles.headerSubtitle}>Manage stock and menu items</Text>
      </View>

      {!selectedShop ? (
        <>
          <FlatList
            data={shops}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={renderShopItem}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No shops found</Text>
              </View>
            }
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.detailContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setSelectedShop(null)
              setForm(emptyForm)
              setShowAddModal(false)
            }}
          >
            <Text style={styles.backButtonText}>← Back to Shops</Text>
          </TouchableOpacity>

          <Text style={styles.selectedTitle}>
            {selectedShop.name ?? 'Selected Shop'}
          </Text>

          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>Menu Items</Text>

            {loadingItems ? (
              <View style={styles.centerInline}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : menuItems.length === 0 ? (
              <Text style={styles.emptyText}>No menu items found</Text>
            ) : (
              <>
                {menuItems.map((item) => (
                  <View key={item.id}>{renderMenuItem({ item })}</View>
                ))}
                <TouchableOpacity
                  style={styles.addItemButton}
                  onPress={() => setShowAddModal(true)}
                >
                  <Text style={styles.addItemButtonText}>+ Add Item</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      )}

      {selectedShop && (
        <>
          <Modal
            visible={showAddModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowAddModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <View style={styles.dragHandle} />
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowAddModal(false)}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalTitle}>Add New Item</Text>

                <ScrollView
                  contentContainerStyle={styles.modalContent}
                  showsVerticalScrollIndicator={false}
                >
                  <TextInput
                    value={form.name}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, name: value }))
                    }
                    placeholder="Name"
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />
                  <TextInput
                    value={form.price}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, price: value }))
                    }
                    placeholder="Price"
                    keyboardType="numeric"
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />
                  <TextInput
                    value={form.description}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, description: value }))
                    }
                    placeholder="Description"
                    style={[styles.input, styles.textArea]}
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                  <TextInput
                    value={form.stock}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, stock: value }))
                    }
                    placeholder="Stock Quantity"
                    keyboardType="numeric"
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />
                  <TextInput
                    value={form.image}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, image: value }))
                    }
                    placeholder="Image URL (optional)"
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      saving && styles.primaryButtonDisabled,
                    ]}
                    onPress={addItem}
                    disabled={saving}
                  >
                    <Text style={styles.primaryButtonText}>
                      {saving ? 'Adding...' : 'Add Item'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerInline: { paddingVertical: 20, alignItems: 'center' },
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
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  shopCard: {
    backgroundColor: COLORS.soft,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shopCardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.subText,
    fontSize: 14,
  },
  detailContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.soft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  selectedTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    color: COLORS.text,
    backgroundColor: '#FAFAFF',
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: COLORS.background,
    fontWeight: '700',
    fontSize: 15,
  },
  menuSection: {
    gap: 12,
  },
  menuCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  menuTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  menuTopLeft: {
    flex: 1,
  },
  menuName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  menuPrice: {
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  menuDescription: {
    color: COLORS.subText,
    marginTop: 10,
    lineHeight: 20,
  },
  stockRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  stockLabel: {
    color: COLORS.text,
    fontWeight: '700',
  },
  stockControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockButtonText: {
    color: COLORS.background,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  stockValueWrap: {
    minWidth: 104,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  stockValueWrapDanger: {
    backgroundColor: COLORS.warningSoft,
    borderColor: '#FDE68A',
  },
  stockValue: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
  stockValueDanger: {
    color: '#B45309',
  },
  addItemButton: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addItemButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '88%',
  },
  modalHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dragHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: -2,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: COLORS.subText,
    fontSize: 20,
    fontWeight: '700',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  modalContent: {
    paddingBottom: 12,
  },
})
