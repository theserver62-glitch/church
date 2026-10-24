// Firebase 웹 설정(콘솔 > 프로젝트 설정 > 내 앱 > church-web).
// 이 값은 비밀번호가 아니라 "어느 프로젝트인지" 알려 주는 주소라서 웹에 공개돼도 된다.
// 보호는 firestore.rules(교회 코드를 아는 사람만 읽고 쓰기)가 맡는다. 공개 후에는 API 키를 공개 주소에서만 쓰게 제한한다.
export const firebaseConfig = {
  apiKey: 'AIzaSyC9Zeq9yNFGRcZIQxOC0mAuQwNdJ4mRDJI',
  authDomain: 'church-planner-8d4b5.firebaseapp.com',
  projectId: 'church-planner-8d4b5',
  storageBucket: 'church-planner-8d4b5.firebasestorage.app',
  messagingSenderId: '543284676706',
  appId: '1:543284676706:web:68cd4673cd00f79ae8e93b',
};
