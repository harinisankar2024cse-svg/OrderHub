import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

export default function ShopkeeperHome() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [shopId, setShopId] = useState<string>('');

  useEffect(() => {
    if (!permission?.granted) {
      setScanned(false);
      setScanning(false);
      setOrderData(null);
    }
  }, [permission?.granted]);

  useEffect(() => {
    const init = async () => {
      const uid = getAuth().currentUser?.uid;
      if (!uid) return;
      const userSnap = await getDoc(doc(db, 'users', uid));
      setShopId(userSnap.data()?.shopId ?? '');
    };
    init();
  }, []);

  async function handleScan({ data }: { data: string }) {
    if (scanned || scanning) return;
    setScanned(true);
    setScanning(true);

    try {
      const parsed = JSON.parse(data);
      const orderId = parsed.orderId;
      if (!orderId) throw new Error('Invalid QR');

      const snap = await getDoc(doc(db, 'orders', orderId));
      if (!snap.exists()) throw new Error('Order not found');

      const orderDoc: any = { orderId: snap.id, ...snap.data() };
      if (shopId && orderDoc.shopId !== shopId) {
        Alert.alert('Wrong Shop', 'This order belongs to a different shop.');
        setScanned(false);
        return;
      }
      if (orderDoc.status === 'completed' || orderDoc.qrScanned === true) {
        throw new Error('Order already scanned');
      }

      const currentOrderRef = doc(db, 'orders', orderId);
      const shopRef = doc(db, 'shops', orderDoc.shopId);
      const pendingSnap = await getDocs(
        query(
          collection(db, 'orders'),
          where('shopId', '==', orderDoc.shopId)
        )
      );

      const remainingTokens = pendingSnap.docs
        .map((d) => d.data())
        .filter(
          (d) =>
            d.status !== 'completed' && d.tokenNumber !== orderDoc.tokenNumber
        )
        .map((d) => d.tokenNumber as number)
        .sort((a, b) => a - b);

      const shopSnap = await getDoc(doc(db, 'shops', orderDoc.shopId));
      const currentActive = shopSnap.data()?.activeToken ?? 0;
      const nextToken =
        remainingTokens.length > 0 ? remainingTokens[0] : currentActive + 1;

      const batch = writeBatch(db);
      batch.update(currentOrderRef, {
        status: 'completed',
        qrScanned: true,
        completedAt: serverTimestamp(),
      });
      batch.update(shopRef, {
        activeToken: nextToken,
      });

      await batch.commit();

      setOrderData(orderDoc);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Scan failed');
      setScanned(false);
    } finally {
      setScanning(false);
    }
  }

  if (!permission || !permission.granted) {
    return (
      <View style={styles.permissionRoot}>
        <Text style={styles.permissionText}>Camera permission needed</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!orderData) {
    return (
      <View style={styles.scannerRoot}>
        <View style={styles.scannerHeader}>
          <Text style={styles.scannerHeaderTitle}>Scan Order QR</Text>
        </View>

        <CameraView
          style={styles.scannerCamera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={!scanned ? handleScan : undefined}
        />

        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.frameWrap}>
            <View style={styles.frame}>
              <View style={styles.cornerTopLeft}>
                <View style={styles.lineTopLeftH} />
                <View style={styles.lineTopLeftV} />
              </View>
              <View style={styles.cornerTopRight}>
                <View style={styles.lineTopRightH} />
                <View style={styles.lineTopRightV} />
              </View>
              <View style={styles.cornerBottomLeft}>
                <View style={styles.lineBottomLeftH} />
                <View style={styles.lineBottomLeftV} />
              </View>
              <View style={styles.cornerBottomRight}>
                <View style={styles.lineBottomRightH} />
                <View style={styles.lineBottomRightV} />
              </View>
            </View>

            <Text style={styles.overlayHint}>Align QR within frame</Text>
          </View>

          {scanning && (
            <View style={styles.overlayLoader}>
              <ActivityIndicator color="#FFFFFF" size="large" />
            </View>
          )}
        </View>

        <View style={styles.bottomCard}>
          <Text style={styles.bottomCardTitle}>Ready to scan</Text>
          <Text style={styles.bottomCardSub}>{"Point at student's order QR code"}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.detailsRoot}>
      <View style={styles.detailsHeader}>
        <Text style={styles.detailsHeaderTitle}>Order Details</Text>
        <TouchableOpacity
          style={styles.detailsClose}
          onPress={() => {
            setOrderData(null);
            setScanned(false);
          }}
        >
          <Text style={styles.detailsCloseText}>✕ Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.detailsContent}>
        <View style={styles.tokenCard}>
          <Text style={styles.tokenLabel}>TOKEN</Text>
          <Text style={styles.tokenNumber}>
            #{String(orderData.tokenNumber ?? 0).padStart(4, '0')}
          </Text>
          <Text style={styles.tokenShop}>{orderData.shopName}</Text>
        </View>

        <View style={styles.itemsCard}>
          <Text style={styles.itemsTitle}>Order Items</Text>
          {(orderData.items ?? []).map((item: any, index: number) => (
            <View key={index}>
              <View style={styles.itemRow}>
                <Text style={styles.itemName}>{item.qty}x {item.name}</Text>
                <Text style={styles.itemPrice}>₹{(item.price ?? 0) * (item.qty ?? 0)}</Text>
              </View>
              {index < (orderData.items?.length ?? 0) - 1 && <View style={styles.itemDivider} />}
            </View>
          ))}

          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{orderData.total}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            setOrderData(null);
            setScanned(false);
          }}
        >
          <Text style={styles.secondaryButtonText}>Scan Next Order</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scannerRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerHeader: {
    backgroundColor: '#7C5CFF',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  scannerHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scannerCamera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
  },
  lineTopLeftH: {
    width: 30,
    height: 3,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  lineTopLeftV: {
    width: 3,
    height: 30,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
  },
  lineTopRightH: {
    width: 30,
    height: 3,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 0,
    right: 0,
  },
  lineTopRightV: {
    width: 3,
    height: 30,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 0,
    right: 0,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
  },
  lineBottomLeftH: {
    width: 30,
    height: 3,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  lineBottomLeftV: {
    width: 3,
    height: 30,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
  },
  lineBottomRightH: {
    width: 30,
    height: 3,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  lineBottomRightV: {
    width: 3,
    height: 30,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  overlayHint: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center',
  },
  overlayLoader: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  bottomCardTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#1A1A1A',
  },
  bottomCardSub: {
    color: '#999999',
    fontSize: 13,
    marginTop: 4,
  },
  permissionRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  permissionText: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 14,
  },
  permissionButton: {
    backgroundColor: '#7C5CFF',
    padding: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  detailsRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  detailsHeader: {
    backgroundColor: '#7C5CFF',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailsClose: {
    paddingVertical: 4,
  },
  detailsCloseText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  detailsContent: {
    padding: 16,
  },
  tokenCard: {
    backgroundColor: '#F6F4FF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  tokenLabel: {
    fontSize: 11,
    color: '#999999',
    letterSpacing: 2,
  },
  tokenNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: '#7C5CFF',
  },
  tokenShop: {
    color: '#666666',
    marginTop: 6,
  },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE6FF',
    marginBottom: 16,
  },
  itemsTitle: {
    fontWeight: '700',
    marginBottom: 12,
    color: '#1A1A1A',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemName: {
    flex: 1,
    color: '#1A1A1A',
  },
  itemPrice: {
    color: '#7C5CFF',
    fontWeight: '600',
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#f0f0f5',
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontWeight: '700',
    color: '#1A1A1A',
  },
  totalValue: {
    fontWeight: '800',
    color: '#7C5CFF',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#7C5CFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#7C5CFF',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#7C5CFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
