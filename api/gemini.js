// ===================================================
// Gemini에게 물어보는 서버 코드가 들어올 자리 (아직 비어 있습니다)
//
// 왜 서버가 필요한가요?
//   API 키를 브라우저 코드(app.js)에 적으면 누구나 볼 수 있습니다.
//   그래서 키는 서버에만 두고, 브라우저는 이 주소로 부탁만 합니다.
//
// 왜 Firebase Functions가 아니라 여기인가요?
//   Firebase Functions는 유료 요금제(Blaze)라야 씁니다.
//   이 프로젝트는 무료 요금제(Spark)로 진행하므로,
//   서버가 필요한 일은 Vercel의 무료 함수로 처리합니다.
//
// 이 파일의 규칙
//   api 폴더 안의 파일은 Vercel에서 자동으로 서버 주소가 됩니다.
//   이 파일은 /api/gemini 주소가 됩니다.
//   API 키는 코드에 적지 말고 Vercel 환경변수에 넣습니다. (process.env 로 꺼내 씁니다)
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

    // 무료 사용 가능한 gemini-1.5-flash 모델 호출
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API 호출 에러:", response.status, errorText);
      return res.status(response.status).json({
        error: `Gemini API 호출에 실패했습니다 (${response.status})`
      });
    }

    const data = await response.json();
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!comment) {
      return res.status(500).json({ error: "Gemini로부터 코멘트를 생성받지 못했습니다." });
    }

    return res.status(200).json({ comment: comment });
  } catch (err) {
    console.error("서버 처리 중 오류 발생:", err);
    return res.status(500).json({ error: "서버 처리 중 오류가 발생했습니다: " + err.message });
  }
}
