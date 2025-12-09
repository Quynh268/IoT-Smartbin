import { addDoc, collection, Timestamp, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "./firebase";

// Collection Firestore: trash_logs
const logRef = collection(db, "trash_logs");

// Hàm ghi log "emptied"
export async function addTrashLog(event: string) {
  try {
    await addDoc(logRef, {
      event,
      ts: Timestamp.now(),
    });

    console.log("🔥 Saved log to Firestore:", event);
  } catch (err) {
    console.error("❌ Failed to write Firestore log:", err);
  }
}

/**
 * Trả về số lần "emptied" trong ngày hiện tại (theo timezone client).
 * Sử dụng field ts (Timestamp) trong Firestore.
 */
export async function getTodayDumpCount(): Promise<number> {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);

    const q = query(
      logRef,
      where("event", "==", "emptied"),
      // nếu muốn tránh index, comment hai where ts và filter client-side (nhưng đây là getDocs, có thể OK)
      where("ts", ">=", startTs),
      where("ts", "<=", endTs)
    );

    const snap = await getDocs(q);
    return snap.size;
  } catch (err) {
    console.error("getTodayDumpCount error:", err);
    // fallback: try client-side scan of all 'emptied' docs (safe but heavier)
    try {
      const q2 = query(logRef, where("event", "==", "emptied"));
      const snap2 = await getDocs(q2);
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

      let count = 0;
      snap2.forEach(doc => {
        const d = doc.data();
        const tsDate = d.ts && d.ts.toDate ? d.ts.toDate().getTime() : new Date(d.ts).getTime();
        if (tsDate >= start && tsDate <= end) count++;
      });
      return count;
    } catch (err2) {
      console.error("Fallback getTodayDumpCount also failed:", err2);
      return 0;
    }
  }
}

export async function getDumpCountByDate(date: Date): Promise<number> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const q = query(
    logRef,
    where("event", "==", "emptied"),
    where("ts", ">=", Timestamp.fromDate(start)),
    where("ts", "<=", Timestamp.fromDate(end))
  );

  const snap = await getDocs(q);
  return snap.size;
}
export async function getTodayVsYesterday() {
  const now = new Date();
  now.setHours(now.getHours() + 7); // ép về GMT+7 Việt Nam

  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);

  const startYesterday = new Date(startToday);
  startYesterday.setDate(startToday.getDate() - 1);

  const endYesterday = new Date(endToday);
  endYesterday.setDate(endToday.getDate() - 1);

  const todayQ = query(
    logRef,
    where("event", "==", "emptied"),
    where("ts", ">=", Timestamp.fromDate(startToday)),
    where("ts", "<=", Timestamp.fromDate(endToday))
  );

  const yesterdayQ = query(
    logRef,
    where("event", "==", "emptied"),
    where("ts", ">=", Timestamp.fromDate(startYesterday)),
    where("ts", "<=", Timestamp.fromDate(endYesterday))
  );

  const [todaySnap, yesterdaySnap] = await Promise.all([
    getDocs(todayQ),
    getDocs(yesterdayQ)
  ]);

  console.log("📊 Firebase Stats:", {
    today: todaySnap.size,
    yesterday: yesterdaySnap.size
  });

  return {
    today: todaySnap.size,
    yesterday: yesterdaySnap.size,
    diff: todaySnap.size - yesterdaySnap.size
  };
}

export async function getTrashHistory() {
  const q = query(logRef, orderBy("ts", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((doc) => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      time: data.ts?.toDate?.() ?? new Date(),
      event: data.event,
    };
  });
}
