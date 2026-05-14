import { db } from '../firebase/firebaseConfig';
import { doc, runTransaction } from 'firebase/firestore';

export async function generateShopToken(shopId) {
  const shopRef = doc(db, 'shops', shopId);

  const newToken = await runTransaction(db, async (transaction) => {
    const shopSnap = await transaction.get(shopRef);

    if (!shopSnap.exists()) {
      transaction.set(shopRef, {
        tokenCounter: 1,
        activeToken: 1,
        isQueueActive: true,
      });
      return 1;
    }

    const currentCounter = shopSnap.data().tokenCounter ?? 0;
    const nextToken = currentCounter + 1;
    transaction.update(shopRef, { tokenCounter: nextToken });
    return nextToken;
  });

  return newToken;
}
