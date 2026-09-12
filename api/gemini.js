// ===================================================
// Gemini에게 담벼락 게시물 코멘트를 요청하는 Vercel 서버리스 함수
//
// 규칙:
// - Firebase Functions(유료 Blaze 필요) 대신 Vercel 무료 서버리스 함수를 사용합니다.
// - API 키는 클라이언트(app.js)에 노출하지 않고 Vercel 환경변수(process.env.GEMINI_API_KEY)로 관리합니다.
// - 학생 개인정보(uid, 이메일 등)는 전달받지 않고 오직 메모 내용(text)만 처리합니다.
// ===================================================

export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정의 Environment Variables에 GEMINI_API_KEY를 등록해 주세요."
    });
  }

  const { texts } = req.body || {};
  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return res.status(400).json({ error: "코멘트를 생성할 게시물 내용이 없습니다." });
  }

  try {
    // 담벼락 메모 내용을 프롬프트로 구성 (학생 개인정보 없이 오직 텍스트만 전달)
    const memoListText = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
    const prompt = `당신은 초등·중학교 학급의 따뜻하고 지혜로운 AI 보조교사입니다.
우리 반 학생들이 학급 담벼락에 다음과 같은 글들을 올렸습니다:

${memoListText}

위 학생들의 글들을 종합하여 다음 사항을 담은 따뜻하고 격려하는 총평 코멘트를 3~5문장 내외로 작성해 주세요:
1. 학생들이 표현한 주요 생각이나 관심사에 대한 긍정적인 공감과 칭찬
2. 학생들이 함께 나누면 좋을 생각거리나 다정한 응원의 한마디
(친근하고 따뜻한 어조(해요체)로 작성해 주세요.)`;

    // 무료 티어 지원 최신 모델 목록 (일시적 서버 과부하/503 대비 자동 폴백 적용)
    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash"
    ];

    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ]
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const comment = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (comment) {
            return res.status(200).json({ comment: comment, model: model });
          }
        } else {
          const errorText = await response.text();
          console.warn(`[${model}] 호출 실패 (${response.status}):`, errorText);
          let parsedMessage = errorText;
          try {
            const errObj = JSON.parse(errorText);
            parsedMessage = errObj.error?.message || errorText;
          } catch (_) {}
          lastError = `${model} (${response.status}): ${parsedMessage}`;
        }
      } catch (fetchErr) {
        console.warn(`[${model}] 네트워크 에러:`, fetchErr.message);
        lastError = `${model}: ${fetchErr.message}`;
      }
    }

    // 모든 모델에서 실패한 경우
    return res.status(503).json({
      error: `Gemini 서버가 일시적으로 응답하지 못했습니다. 잠시 후 다시 시도해 주세요. (${lastError})`
    });
  } catch (err) {
    console.error("서버 처리 중 오류 발생:", err);
    return res.status(500).json({ error: "서버 처리 중 오류가 발생했습니다: " + err.message });
  }
}
