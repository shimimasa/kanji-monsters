// Firebase Web の APIキーは公開前提の識別子であり「秘密」ではない（本ファイルはgit追跡で問題ない）。
// セキュリティは Firestore セキュリティルールで担保する:
// 匿名認証ユーザーが自分の users/{uid} 以外へ読み書きできないルールになっていることを必ず確認すること。
export const firebaseConfig = {
    apiKey: "AIzaSyCB45IBM6ktHqDgz6YxKG4D2Dp0V8sayts",
  authDomain: "kanjibattlerpg-proto.firebaseapp.com",
  projectId: "kanjibattlerpg-proto",
  storageBucket: "kanjibattlerpg-proto.firebasestorage.app",
  messagingSenderId: "92199045966",
  appId: "1:92199045966:web:767334da845831378fac1f"
  };
  