import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../utils/colors';

const shops = [
  { id: '1', name: 'REC Cafe', category: 'Coffee & Snacks', bg: COLORS.primary, emoji: '\u{1F35C}' },
  { id: '2', name: 'Hut Cafe', category: 'Fast Food', bg: COLORS.primary, emoji: '\u{1F96A}' },
  { id: '3', name: 'REC Mart', category: 'Groceries', bg: COLORS.primary, emoji: '\u{1F6CD}\u{FE0F}' },
  { id: '4', name: 'Dominos', category: 'Pizza', bg: COLORS.primary, emoji: '\u{1F355}' },
  { id: '5', name: 'Black Bug Cafe', category: 'Burgers & Shakes', bg: COLORS.primary, emoji: '\u{1F354}' },
  { id: '6', name: 'Cafe Coffee Day', category: 'Coffee & Beverages', bg: COLORS.primary, emoji: '\u{2615}' },
];

export default function StudentHome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day</Text>
          <Text style={styles.headerTitle}>What would you like?</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Available Shops</Text>
        <View style={styles.row}>
          {shops.map(shop => (
            <TouchableOpacity
              key={shop.id}
              style={[styles.card, { backgroundColor: shop.bg }]}
              onPress={() =>
                router.push(
                  `/student/menu?shopId=${shop.id}&shopName=${shop.name}`
                )
              }
            >
              <Text style={styles.emoji}>{shop.emoji}</Text>
              <Text style={styles.cardName}>{shop.name}</Text>
              <Text style={styles.cardCategory}>{shop.category}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: COLORS.primary,
  },
  greeting: {
    fontSize: 13,
    color: COLORS.background,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.background,
  },
  grid: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    borderRadius: 20,
    padding: 20,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.textPrimary,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  emoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.background,
    textAlign: 'center',
  },
  cardCategory: {
    fontSize: 11,
    color: COLORS.highlight,
    marginTop: 4,
    textAlign: 'center',
  },
});
