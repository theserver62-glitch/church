// 교회 설정 권한: 링크로 들어온 사람은 사용, 설정(이름·부서·규모·절기 켜고 끄기)은 관리자만. firestore.rules와 같은 판정.
import { DELETE } from './store.js?v=202610251020';
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k) && !!o[k];
export const isAdmin = (doc, uid) => !!uid && own(doc?.admins, uid);
export const adminList = doc => Object.entries(doc?.admins || {}).filter(([, v]) => v).map(([uid, v]) => ({ uid, ...v }));
export const requestList = doc => Object.entries(doc?.adminRequests || {}).filter(([, v]) => v).map(([uid, v]) => ({ uid, ...v }));
export const hasAdmins = doc => adminList(doc).length > 0;
// 체험 모드(이 기기)는 권한 없이 다 된다
export const canEditSettings = (doc, uid, mode) => mode === 'local' || isAdmin(doc, uid);
const who = (u, at) => ({ name: (u.displayName || u.email || '이름 없음').slice(0, 40), email: (u.email || '').slice(0, 80), at });
// 쓰기 내용들(store.update에 그대로 넣는다)
export const requestPatch = (u, at) => ({ adminRequests: { [u.uid]: who(u, at) } });
export const cancelRequestPatch = uid => ({ adminRequests: { [uid]: DELETE } });
export const claimFirstPatch = (u, at) => ({ admins: { [u.uid]: who(u, at) }, adminRequests: { [u.uid]: DELETE } });
export const approvePatch = (req, at) => ({ admins: { [req.uid]: { name: req.name || '', email: req.email || '', at } }, adminRequests: { [req.uid]: DELETE } });
export const rejectPatch = uid => ({ adminRequests: { [uid]: DELETE } });
// 마지막 관리자는 뺄 수 없다(아무도 설정을 못 바꾸게 되니까) → null
export const removeAdminPatch = (doc, uid) => (adminList(doc).length <= 1 || !isAdmin(doc, uid) ? null : { admins: { [uid]: DELETE } });
export const isPermissionError = e => e?.code === 'permission-denied' || /permission/i.test(e?.message || '');
