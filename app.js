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
  query,
  getDoc,
  setDoc
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
// 현재 사용자 역할 ('teacher' 또는 'student')
let currentUserRole = "student";


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
      author: currentUser.displayName || "익명",
      role: currentUserRole
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

  // 교사(teacher)는 모든 메모를 삭제할 수 있고,
  // 학생(student)은 오직 본인이 쓴 메모만 삭제할 수 있습니다 (다른 사람 메모는 건들지 못함).
  const canDelete = currentUser && (currentUserRole === "teacher" || memo.uid === currentUser.uid);

  if (canDelete) {
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

  // 작성자 정보 및 역할 뱃지 표시
  if (memo.author) {
    const authorDiv = document.createElement("div");
    authorDiv.style.fontSize = "12px";
    authorDiv.style.color = "#777";
    authorDiv.style.marginTop = "6px";
    const roleBadge = memo.role === "teacher" ? " (교사)" : " (학생)";
    authorDiv.textContent = `- ${memo.author}${memo.role ? roleBadge : ""}`;
    div.appendChild(authorDiv);
  }

  return div;
}


// ===================================================
// AI 코멘트 생성 (교사 전용 기능 - Vercel /api/gemini 호출)
// ===================================================

async function generateAiComment() {
  const aiArea = document.getElementById("aiArea");
  const aiContent = document.getElementById("aiContent");
  const aiBtn = document.getElementById("aiCommentBtn");

  const memos = await loadMemos();
  if (!memos || memos.length === 0) {
    alert("담벼락에 게시물이 없습니다. 메모를 먼저 작성해 주세요.");
    return;
  }

  if (aiBtn) {
    aiBtn.disabled = true;
    aiBtn.textContent = "🤖 AI 코멘트 작성 중...";
  }

  if (aiArea) aiArea.style.display = "block";
  if (aiContent) aiContent.textContent = "AI가 학생들의 글을 종합하여 따뜻한 코멘트를 작성하고 있습니다. 잠시만 기다려 주세요...";

  try {
    // AGENTS.md 규칙 준수: uid, 이메일 등 개인정보를 제외하고 오직 메모 텍스트만 전송
    const texts = memos.map(function (m) { return m.text; });

    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: texts })
    });

    if (!res.ok) {
      const errData = await res.json().catch(function () { return {}; });
      throw new Error(errData.error || `서버 응답 오류 (${res.status})`);
    }

    const data = await res.json();
    if (aiContent) aiContent.textContent = data.comment;
  } catch (err) {
    console.error("AI 코멘트 생성 실패:", err);
    if (aiContent) {
      aiContent.textContent = "AI 코멘트를 가져오지 못했습니다.\n\n" +
        "💡 오류 내용: " + err.message + "\n" +
        "(참고: 로컬 Live Server에서는 Vercel 서버리스 함수(/api/gemini)가 동작하지 않습니다. " +
        "Vercel에 배포된 사이트에서 GEMINI_API_KEY 환경변수를 설정하고 확인해 주세요.)";
    }
  } finally {
    if (aiBtn) {
      aiBtn.disabled = false;
      aiBtn.textContent = "✨ AI 담벼락 코멘트";
    }
  }
}


// ===================================================
// 사용자 로그인 영역 (Google 로그인 및 역할 표시)
// ===================================================

const userArea = document.getElementById("userArea");

function renderUserArea() {
  userArea.innerHTML = "";

  if (currentUser) {
    const roleText = currentUserRole === "teacher" ? "교사" : "학생";
    const userSpan = document.createElement("span");
    userSpan.textContent = `${currentUser.displayName || "사용자"}님 [${roleText}] `;

    // 실습 테스트를 위한 역할 전환 버튼
    const switchBtn = document.createElement("button");
    switchBtn.style.marginRight = "6px";
    switchBtn.textContent = currentUserRole === "teacher" ? "학생으로 전환" : "교사로 전환";
    switchBtn.addEventListener("click", async function () {
      currentUserRole = currentUserRole === "teacher" ? "student" : "teacher";
      try {
        await setDoc(doc(db, "users", currentUser.uid), { role: currentUserRole }, { merge: true });
      } catch (err) {
        console.error("역할 저장 실패:", err);
      }
      renderUserArea();
      render();
    });

    userArea.appendChild(userSpan);
    userArea.appendChild(switchBtn);

    // 교사(teacher)에게만 AI 담벼락 코멘트 버튼 표시
    if (currentUserRole === "teacher") {
      const aiBtn = document.createElement("button");
      aiBtn.id = "aiCommentBtn";
      aiBtn.style.marginRight = "6px";
      aiBtn.style.background = "#e8f0fe";
      aiBtn.style.color = "#1a73e8";
      aiBtn.style.border = "1px solid #1a73e8";
      aiBtn.style.cursor = "pointer";
      aiBtn.textContent = "✨ AI 담벼락 코멘트";
      aiBtn.addEventListener("click", generateAiComment);
      userArea.appendChild(aiBtn);
    }

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", async function () {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("로그아웃 실패:", error);
      }
    });

    userArea.appendChild(logoutBtn);

    input.disabled = false;
    input.placeholder = currentUserRole === "teacher"
      ? "메모를 쓰고 엔터 (교사: 모든 권한)"
      : "메모를 쓰고 엔터 (학생: 본인 메모 생성만 가능)";
  } else {
    // 로그아웃 시 AI 코멘트 영역도 초기화
    const aiArea = document.getElementById("aiArea");
    const aiContent = document.getElementById("aiContent");
    if (aiArea) aiArea.style.display = "none";
    if (aiContent) aiContent.textContent = "";

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

onAuthStateChanged(auth, async function (user) {
  currentUser = user;
  if (currentUser) {
    // Firestore users 컬렉션에서 역할(teacher / student) 조회
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().role) {
        currentUserRole = userDocSnap.data().role;
      } else {
        // 최초 로그인 시 교사(teacher)로 기본 등록
        currentUserRole = "teacher";
        await setDoc(userDocRef, { role: currentUserRole });
      }
    } catch (err) {
      console.error("역할 조회 실패:", err);
      currentUserRole = "student";
    }
  } else {
    currentUserRole = "student";
  }

  renderUserArea();
  render();
  if (currentUser) {
    input.focus();
  }
});
