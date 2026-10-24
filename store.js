// 저장소. config.js에 Firebase 설정이 있으면 Firestore(리더끼리 실시간 공유),
// 없으면 이 기기 localStorage(체험 모드, 같은 브라우저의 다른 탭끼리만 공유).
// 쓰기는 늘 "깊게 합치기"라서 두 사람이 다른 칸을 동시에 고쳐도 서로 지우지 않는다(배열은 통째로 바뀜).
import { firebaseConfig } from './config.js?v=202610241314';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export async function openStore() {
  if (firebaseConfig) {
    const { initializeApp } = await import(FB + 'firebase-app.js');
    const { getFirestore, doc, onSnapshot, setDoc } = await import(FB + 'firebase-firestore.js');
    const A = await import(FB + 'firebase-auth.js');
    // Firebase 주소(web.app)에서 열리면 로그인도 같은 주소로 처리한다 — 사파리가 다른 주소 사이의 로그인 결과를 막아서 멈추는 문제 방지
    const host = location.hostname, sameSite = /\.(web\.app|firebaseapp\.com)$/.test(host);
    const app = initializeApp({ ...firebaseConfig, authDomain: sameSite ? host : firebaseConfig.authDomain });
    const db = getFirestore(app);
    const auth = A.getAuth(app);
    return {
      mode: 'shared',
      // 구글 로그인(선택). 로그인한 사람은 users/{uid}에 "내 교회 목록"을 둔다 — 본인만 읽고 쓴다(firestore.rules).
      auth: {
        ready: new Promise(r => { const off = A.onAuthStateChanged(auth, u => { off(); r(u); }); }),
        user: () => auth.currentUser,
        // 팝업이 막히는 브라우저(일부 휴대폰)는 페이지 이동 방식으로 다시 시도한다. 돌아오면 redirectResult로 받는다.
        signIn: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()).catch(e => {
          if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') return A.signInWithRedirect(auth, new A.GoogleAuthProvider());
          throw e;
        }),
        redirectResult: () => A.getRedirectResult(auth).catch(e => { throw e; }),
        signOut: () => A.signOut(auth),
      },
      // cb(data) — 문서가 없으면 null
      watch: (path, cb, onErr) => onSnapshot(doc(db, path), s => cb(s.exists() ? s.data() : null), onErr),
      update: (path, data) => setDoc(doc(db, path), data, { merge: true }),
    };
  }
  return localStore();
}

export function deepMerge(base, add) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(add)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(out[k], v) : v;
  }
  return out;
}

function localStore() {
  const key = path => 'church:' + path;
  const read = path => { try { return JSON.parse(localStorage.getItem(key(path))); } catch { return null; } };
  const subs = new Set();
  const notify = path => subs.forEach(s => s.path === path && s.cb(read(path)));
  // 다른 탭에서 고친 것도 바로 보이게
  addEventListener('storage', e => e.key?.startsWith('church:') && notify(e.key.slice(7)));
  return {
    mode: 'local',
    auth: null, // 체험 모드에는 로그인이 없다
    watch(path, cb) {
      const s = { path, cb };
      subs.add(s);
      queueMicrotask(() => cb(read(path)));
      return () => subs.delete(s);
    },
    async update(path, data) {
      localStorage.setItem(key(path), JSON.stringify(deepMerge(read(path), data)));
      notify(path);
    },
  };
}

// 교회 코드: 헷갈리는 글자(0/O, 1/I/L) 뺀 10자. Firestore 규칙도 10자 이상만 받는다.
export function newChurchCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(10));
  const s = [...r].map(n => abc[n % abc.length]).join('');
  return s.slice(0, 5) + '-' + s.slice(5);
}

export const normalizeCode = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{5})(.{5})$/, '$1-$2');
