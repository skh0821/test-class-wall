// ===================================================
// 우리 반 담벼락 - 시작점
//
// 메모를 쓰면 올린 순서대로 담벼락에 붙습니다.
// Firebase Firestore와 연동되어 데이터가 영구적으로 저장됩니다.
// ===================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// 웹 앱의 Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyC16fMVBE9m3oMu3OyB4Z9RkFti6uZxLKk",
  authDomain: "test-class-wall-skh.firebaseapp.com",
  projectId: "test-class-wall-skh",
  storageBucket: "test-class-wall-skh.firebasestorage.app",
  messagingSenderId: "983452150239",
  appId: "1:983452150239:web:b91a86fe2003f4d6e07c6a"
};

// Firebase, Firestore, Auth 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 현재 로그인한 사용자 정보 (로그인 안 됨: null)
let currentUser = null;


// ===================================================
// 데이터를 다루는 함수 세 개
// 백엔드 1: Firestore를 사용하는 비동기 함수로 연동되었습니다.
// ===================================================

// Firestore 컬렉션 이름
const COLLECTION_NAME = "test-class-wall";

// 메모를 읽어 옵니다.
// Firestore의 test-class-wall 컬렉션에서 createdAt 기준으로 오름차순 정렬하여 가져옵니다.
async function loadMemos() {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "asc"));
    const querySnapshot = await getDocs(q);
    const loadedMemos = [];
    querySnapshot.forEach(function (docSnap) {
      loadedMemos.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    return loadedMemos;
  } catch (error) {
    console.error("메모 불러오기 실패:", error);
    return [];
  }
}

// 메모를 새로 씁니다.
// 5글자 이상일 때만 Firestore에 저장합니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  if (!currentUser) {
    alert("로그인 후 메모를 작성할 수 있습니다.");
    return false;
  }

  const trimmedText = text ? text.trim() : "";
  if (trimmedText.length < 5) {
    alert("메모는 5글자 이상 입력해 주세요.");
    return false;
  }

  try {
    await addDoc(collection(db, COLLECTION_NAME), {
      text: trimmedText,
      createdAt: Date.now(),
      uid: currentUser.uid,
      author: currentUser.displayName || "익명"
    });
    return true;
  } catch (error) {
    console.error("메모 저장 실패:", error);
    return false;
  }
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error("메모 삭제 실패:", error);
  }
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  // 로그아웃 상태이면 메모 목록을 정리(화면 비움)합니다
  if (!currentUser) {
    return;
  }

  const memos = await loadMemos();
  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 백엔드 2: 내가 쓴 메모(또는 작성자 정보가 없는 기존 메모)에만 삭제(×) 버튼 표시
  if (!memo.uid || (currentUser && memo.uid === currentUser.uid)) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.addEventListener("click", async function () {
      await deleteMemo(memo.id);
      await render();
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 작성자 정보가 있으면 하단에 표시
  if (memo.author) {
    const authorDiv = document.createElement("div");
    authorDiv.style.fontSize = "12px";
    authorDiv.style.color = "#777";
    authorDiv.style.marginTop = "6px";
    authorDiv.textContent = `- ${memo.author}`;
    div.appendChild(authorDiv);
  }

  return div;
}


// ===================================================
// 사용자 로그인 영역 (Google 로그인)
// ===================================================

const userArea = document.getElementById("userArea");

function renderUserArea() {
  userArea.innerHTML = "";

  if (currentUser) {
    const userSpan = document.createElement("span");
    userSpan.textContent = `${currentUser.displayName || "사용자"}님 `;

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", async function () {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("로그아웃 실패:", error);
      }
    });

    userArea.appendChild(userSpan);
    userArea.appendChild(logoutBtn);

    input.disabled = false;
    input.placeholder = "메모를 쓰고 엔터 (5글자 이상)";
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Google로 로그인";
    loginBtn.addEventListener("click", async function () {
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("로그인 실패:", error);
        alert("로그인에 실패했습니다: " + error.message);
      }
    });

    userArea.appendChild(loginBtn);

    input.disabled = true;
    input.placeholder = "로그인 후 메모를 작성할 수 있습니다.";
    input.value = "";
  }
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    if (!currentUser) {
      alert("로그인 후 메모를 작성할 수 있습니다.");
      return;
    }

    const text = input.value.trim();
    if (text === "") return;

    if (text.length < 5) {
      alert("메모는 5글자 이상 입력해 주세요.");
      return;
    }

    const saved = await addMemo(text);
    if (saved) {
      input.value = "";
      await render();
    }
  }
});


// ===================================================
// 로그인 상태 변화 감지 및 첫 화면 렌더링
// ===================================================

onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea();
  render();
  if (currentUser) {
    input.focus();
  }
});
