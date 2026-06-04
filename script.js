  let selectedImage = null;
  let selectedLawdCode = "";
  let selectedAddressPayload = null; 
  let currentClauses = [];
  let remainCount = 0;
let safeCount = 0;
let dangerCount = 0;
let unknownCount = 0;
let errorCount = 0;

const countedClauses = new Set();

  const BASE_API_URL =
    "https://stockinged-lakita-dowable.ngrok-free.dev";

  const OCR_API_URL =
    BASE_API_URL + "/api/v1/extract/image";

  const CLAUSE_ANALYZE_API_URL =
    BASE_API_URL + "/api/v1/analyze/clause";

  const JEONSE_API_URL =
    BASE_API_URL + "/api/v1/analyze/property-risk/ai";

    const REQUEST_TIMEOUT = 120000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
    }

    throw error;
  }
}

function getErrorMessage(data, fallback) {
  if (data && data.detail) {
    if (typeof data.detail === "string") {
      return data.detail;
    }

    return JSON.stringify(data.detail);
  }

  return fallback || "오류가 발생했습니다.";
}
function updateSummary() {

  document.getElementById("totalCount").innerText =
    remainCount;

  document.getElementById("safeCount").innerText =
    safeCount;

  document.getElementById("dangerCount").innerText =
    dangerCount;

  document.getElementById("unknownCount").innerText =
    unknownCount;

  document.getElementById("errorCount").innerText =
    errorCount;
}
    
  function showSection(type) {
    [
      "contractSection",
      "resultSection",
      "jeonseSection"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    if (type === "contract") {
      document.getElementById("contractSection").style.display = "block";
    }

    if (type === "result") {
      document.getElementById("resultSection").style.display = "block";
    }

    if (type === "jeonse") {
      document.getElementById("jeonseSection").style.display = "block";
    }
  }

  function handleImageSelect() {
    const fileInput = document.getElementById("clauseImage");
    const fileName = document.getElementById("imageFileName");
    const ocrButton = document.getElementById("ocrButton");

    selectedImage = fileInput.files[0];

    if (selectedImage) {
      fileName.innerText = selectedImage.name;
      ocrButton.disabled = false;
    } else {
      fileName.innerText = "이미지를 업로드해주세요.";
      ocrButton.disabled = true;
    }
  }

  function handleDirectTextInput() {
    const directText = document.getElementById("directText").value.trim();
    document.getElementById("directAnalyzeButton").disabled =
      directText.length < 5;
  }

  async function requestOCR() {
    if (!selectedImage) {
      alert("특약사항 이미지를 선택해주세요.");
      return;
    }

    const popup = document.getElementById("popup");
    const statusMsg = document.getElementById("statusMsg");

    popup.style.display = "flex";
    statusMsg.innerText = "서버에서 이미지 추출 중...";

    const formData = new FormData();
    formData.append("image", selectedImage);

    try {
      const response = await fetchWithTimeout(
  OCR_API_URL, {
        method: "POST",
        body: formData
      });

     if (!response.ok) {

  const errorData =
    await response.json();

  throw new Error(
    getErrorMessage(
      errorData,
      "이미지 분석 중 오류가 발생했습니다."
    )
  );
}

      const data =
      await response.json();

      let clauses = [];

      if (Array.isArray(data)) {
        clauses = data;
      } else if (Array.isArray(data.clauses)) {
        clauses = data.clauses;
      } 

      clauses = clauses
        .map((item, index) => {
          if (typeof item === "string") {
            return {
              id: index + 1,
              clause: item.trim()
            };
          }

          return {
            id: item.id || index + 1,
            clause: item.clause || item.content || ""
          };
        })
        .filter(item => item.clause);

      if (clauses.length === 0) {
        alert("OCR 결과가 비어 있습니다.");
        return;
      }

      await sendClausesToServer(clauses);

    }  catch (error) {

  console.error(error);

  alert(
    error.message ||
    "오류가 발생했습니다."
  );

  }
}
  async function analyzeDirectText() {

  const text =
    document.getElementById("directText")
      .value
      .trim();

  if (!text) {
    alert("분석할 특약사항을 입력해주세요.");
    return;
  }

  try {

    const response =
      await fetchWithTimeout(
        BASE_API_URL +
        "/api/v1/extract/clause",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            text: text
          })
        }
      );

    const data =
      await response.json();

    let clauses = [];

    if (Array.isArray(data)) {
      clauses = data;
    }
    else if (Array.isArray(data.clauses)) {
      clauses = data.clauses;
    }

    clauses =
      clauses.map(
        (item, index) => ({
          id: index + 1,
          clause: item
        })
      );

    await sendClausesToServer(
      clauses
    );

  } catch (error) {

    console.error(error);

    alert(
      "조항 분리 중 오류가 발생했습니다."
    );

  }

}

  

  async function sendClausesToServer(clauses) {
    currentClauses = clauses;

    remainCount = clauses.length;

safeCount = 0;
dangerCount = 0;
unknownCount = 0;
errorCount = 0;

countedClauses.clear();

updateSummary();

    if (!clauses || clauses.length === 0) {
      alert("분석할 조항이 없습니다.");
      return;
    }

    document.getElementById("contractSection").style.display =
      "none";

    document.getElementById("resultSection").style.display =
      "block";

    document.getElementById("popup").style.display =
      "none";

    const finalResultList =
      document.getElementById("finalResultList");

    finalResultList.innerHTML =
      "<h2>⚖️ 조항별 위험도 리포트</h2>";

    clauses.forEach(item => {
      createPendingResultCard(item);
    });

    clauses.forEach(async item => {

      try {

        const response =
          await fetchWithTimeout(
            CLAUSE_ANALYZE_API_URL,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                id: item.id,
                special_clause:
                  item.clause
              })
            }
          );

        const result =
        
  await response.json();

if (result.detail) {

  updateResultCard({
    clause_no: item.id,
    content: item.clause,
    risk: "error",
    reason: getErrorMessage(
  result,
  "분석 중 오류 발생"
),
    extra_statutes: []
  });

  return;
}

const converted =
  convertServerResult(
    result,
    item
  );

updateResultCard(
  converted
);

      } catch (error) {

        updateResultCard({
          clause_no: item.id,
          content: item.clause,
          risk: "error",
          reason:
            "분석 중 오류 발생",
          extra_statutes: []
        });

      }

    });

  }


  function convertServerResult(result, originalItem) {

    const opinion =
    (result.opinion || result.data?.opinion || "").toLowerCase();

    let risk = "unknown";

    if (
      opinion === "safe" ||
      opinion === "유효"
    ) {
      risk = "safe";
    }
    else if (
      opinion === "danger" ||
      opinion === "무효"
    ) {
      risk = "danger";
    }
    else {
      risk = "unknown";
    }

    return {
      clause_no: result.id || originalItem.id,
      content: result.user_input || originalItem.clause,
      risk: risk,
      reason:
    result.reason ||
    result.data?.reason ||
    "분석 사유가 제공되지 않았습니다.",

  extra_statutes:
    result.extra_statutes ||
    result.data?.extra_statutes ||
    []
    };
  }

  function createMockRiskResult(item) {
    let risk = "safe";
    let reason = "특별한 위험 표현이 감지되지 않았습니다.";

    if (
      item.content.includes("부담") ||
      item.content.includes("금지") ||
      item.content.includes("책임") ||
      item.content.includes("해지") ||
      item.content.includes("반환하지")
    ) {
      risk = "danger";
      reason = "임차인에게 불리하거나 과도한 책임이 발생할 가능성이 있습니다.";
    } else if (
      item.content.includes("협의") ||
      item.content.includes("임대인") ||
      item.content.includes("사정") ||
      item.content.includes("특약")
    ) {
      risk = "warning";
      reason = "표현이 모호하거나 해석에 따라 분쟁 가능성이 있습니다.";
    }

    return {
      clause_no: item.clause_no,
      content: item.content,
      risk,
      reason
    };
  }
  function createPendingResultCard(item) {

    const finalResultList =
      document.getElementById(
        "finalResultList"
      );

    const div =
      document.createElement(
        "div"
      );

    div.id =
      `result-card-${item.id}`;

    div.className =
      "result-card unknown";

    div.innerHTML = `
  <span
    class="risk-badge"
    style="
      background:#e5e7eb;
      color:#374151;
    "
  >
    분석중
  </span>

  <strong>
    ${item.id}번 조항
  </strong>

  <p>
    ${escapeHtml(
      item.clause || ""
    )}
  </p>
`;

    finalResultList
      .appendChild(div);

  }
  function updateResultCard(
  result
) {

  if (
    !countedClauses.has(
      result.clause_no
    )
  ) {

    countedClauses.add(
      result.clause_no
    );

    remainCount--;

    if (result.risk === "safe") {
      safeCount++;
    }

    if (result.risk === "danger") {
      dangerCount++;
    }

    if (result.risk === "unknown") {
      unknownCount++;
    }

    if (result.risk === "error") {
      errorCount++;
    }

    updateSummary();
  }

  const div =
      document.getElementById(
        `result-card-${result.clause_no}`
      );

    if (!div) return;

    let label =
      "판단불가";

    let badgeBg =
      "#ede9fe";

    let badgeColor =
      "#6d28d9";

    if (
      result.risk ===
      "safe"
    ) {

      label =
        "안전";

      badgeBg =
        "#dcfce7";

      badgeColor =
        "#166534";
    }

    if (
      result.risk ===
      "danger"
    ) {

      label =
        "위험";

      badgeBg =
        "#fee2e2";

      badgeColor =
        "#991b1b";
    }

    if (
  result.risk ===
  "error"
) {

  label =
    "오류";

  badgeBg =
    "#fef3c7";

  badgeColor =
    "#92400e";
}

    div.className =
      `result-card ${result.risk}`;

   div.innerHTML = `
  <span
    class="risk-badge"
    style="
      background:${badgeBg};
      color:${badgeColor};
    "
  >
    ${label}
  </span>

  <strong>
    ${result.clause_no}
    번 조항
  </strong>

  <p>
    ${escapeHtml(
      result.content || ""
    )}
  </p>

  ${
    result.risk === "error"
      ? `
      <button
        class="retry-btn"
       onclick="retryClauseAnalyze(event, ${result.clause_no}, this)"
      >
        다시 분석
      </button>
      `
      : ""
  }
`;

    div.onclick =
      () => {
        openDetailModal(
          result
        );
      };

  }
  function addResultCard(result) {

    const finalResultList =
      document.getElementById("finalResultList");

    const div =
      document.createElement("div");

    const risk =
      result.risk || "safe";

    div.className =
      `result-card ${risk}`;

    let label = "안전";
    let badgeBg = "#dcfce7";
    let badgeColor = "#166534";

    if (risk === "danger") {
      label = "위험";
      badgeBg = "#fee2e2";
      badgeColor = "#991b1b";
    }

    if (risk === "unknown") {
     unknownCount++;
     label = "판단불가";
     badgeBg = "#ede9fe";
     badgeColor = "#6d28d9";
    }

    div.innerHTML = `
      <span class="risk-badge"
        style="background:${badgeBg};
        color:${badgeColor};">
        ${label}
      </span>

      <strong>
        ${result.clause_no}번 조항
      </strong>

      <p>
        ${escapeHtml(result.content || "")}
      </p>
    `;

    div.onclick = () => {
      openDetailModal(result);
    };

    finalResultList.appendChild(div);
  }

  function renderResults(results) {
    const finalResultList = document.getElementById("finalResultList");


    finalResultList.innerHTML = "<h2>⚖️ 조항별 위험도 리포트</h2>";

  let safeCount = 0;
  let dangerCount = 0;
  let unknownCount = 0;

    results.forEach(result => {
      const div = document.createElement("div");
      const risk = result.risk || "safe";

      div.className = `result-card ${risk}`;

    let label = "안전";
  let badgeBg = "#dcfce7";
  let badgeColor = "#166534";

  if (risk === "safe") {
    safeCount++;
  }

  if (risk === "danger") {
    dangerCount++;
    label = "위험";
    badgeBg = "#fee2e2";
    badgeColor = "#991b1b";
  }

  if (risk === "unknown") {
    unknownCount++;
    label = "판단불가";
    badgeBg = "#e5e7eb";
    badgeColor = "#374151";
  }

      const statutes =
        result.extra_statutes && result.extra_statutes.length > 0
          ? `<div class="reason-box">추가 확인 법령: ${escapeHtml(result.extra_statutes.join(", "))}</div>`
          : "";

      div.innerHTML = `
        <span class="risk-badge" style="background:${badgeBg};color:${badgeColor};">
          ${label}
        </span>
        <strong>${result.clause_no || "-"}번 조항</strong>
        <p>${escapeHtml(result.content || "")}</p>
      `;

      div.onclick = () => {
    openDetailModal(result);
  };
      finalResultList.appendChild(div);
    });
  document.getElementById("totalCount").innerText =
    results.length;

  document.getElementById("safeCount").innerText =
    safeCount;

  document.getElementById("dangerCount").innerText =
    dangerCount;

  document.getElementById("unknownCount").innerText =
    unknownCount;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  

  function execDaumPostcode() {
    new daum.Postcode({
      oncomplete: data => {
        const addressInput = document.getElementById("address");

        addressInput.value =
          data.roadAddress || data.jibunAddress;

        if (data.bcode) {
          selectedLawdCode = data.bcode.substring(0, 5);
        }

        selectedAddressPayload = createAddressPayload(data); 
      }
    }).open();
  }

  function createAddressPayload(data) { 
    const jibun = extractJibun(data.jibunAddress || data.autoJibunAddress || ""); 
    const [mainJibun, subJibun = "0"] = jibun.split("-"); 

    return {
      dong_name: data.bname || "", 
      legal_dong_code: data.bcode || "", 
      jibun: jibun, 
      main_jibun: mainJibun || "", 
      sub_jibun: subJibun || "0", 
      mountain_yn: isMountainJibun(data.jibunAddress || data.autoJibunAddress || "") ? "Y" : "N" 
    };
  }

  function extractJibun(jibunAddress) { 
    const match = jibunAddress.match(/(?:산\s*)?(\d{1,4}(?:-\d{1,4})?)/);

    return match ? match[1] : "";
  }

  function isMountainJibun(jibunAddress) { 
    return /(?:^|\s)산\s*\d/.test(jibunAddress);
  }

  function promptNumberValue(label) { 
    const value = prompt(`${label}를 숫자만 입력해주세요. 예: 101`);

    if (value === null) {
      return null;
    }

    const normalized = value.trim().replace(/[^0-9]/g, "");

    if (!/^\d{1,6}$/.test(normalized)) {
      alert(`${label}는 1~6자리 숫자로 입력해주세요.`);
      return null;
    }

    return normalized;
  }

  async function jeonseAnalyze() {
    const area = parseFloat(document.getElementById("area").value);

    const deposit = parseInt(
      document.getElementById("deposit").value.replace(/,/g, "")
    )*10000;

    const priorBondsValue =
    document.getElementById("priorBonds")?.value || "";

  const priorBonds =
    priorBondsValue.trim() === ""
      ? null
      : parseInt(
          priorBondsValue.replace(/[^0-9]/g, "")
        ) * 10000;

    const address = document.getElementById("address").value;

    const buildingType =
      document.getElementById("buildingType").value;

    if (!area || !deposit || !address || !selectedLawdCode) {
      alert("면적, 전세금, 주소를 모두 입력해주세요.");
      return;
    }

    if (!selectedAddressPayload || !selectedAddressPayload.legal_dong_code) { 
      alert("주소 찾기로 주소를 다시 선택해주세요.");
      return;
    }

    const dongNum =
    document.getElementById("dongNum").value
      .trim()
      .replace(/[^0-9]/g, "");

  const hoNum =
    document.getElementById("hoNum").value
      .trim()
      .replace(/[^0-9]/g, "");

  if (!dongNum || !hoNum) {
    alert("동 번호와 호 번호를 입력해주세요.");
    return;
  }

    const resultBox = document.getElementById("resultBox");
    const resultMessage = document.getElementById("resultMessage");
    const resultDetails = document.getElementById("resultDetails");

    resultBox.style.display = "block";
    
    applyJeonseTotalRiskStyle(resultBox, "unknown");

    resultMessage.innerText = "국토부 실거래가 분석 중...";
    resultDetails.innerText = "";

    try {
      const response = await fetchWithTimeout(
  JEONSE_API_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            address: address,
            lawd_code: selectedLawdCode,
            deposit: deposit,
            area: area,
            building_type: buildingType,
            dong_num: dongNum, 
            ho_num: hoNum, 
            dong_name: selectedAddressPayload.dong_name, 
            legal_dong_code: selectedAddressPayload.legal_dong_code, 
            jibun: selectedAddressPayload.jibun, 
            main_jibun: selectedAddressPayload.main_jibun, 
            sub_jibun: selectedAddressPayload.sub_jibun, 
            mountain_yn: selectedAddressPayload.mountain_yn,
            prior_bonds: priorBonds
            
          })
        }
      );

      if (!response.ok) {

  const errorData =
    await response.json();

    

  throw new Error(
    getErrorMessage(
      errorData,
      "분석 중 오류 발생"
    )
  );
}

      const data = await response.json();

     const riskLevel = data.total_risk_level;
const aiOpinion = Array.isArray(data.ai_opinion)
  ? data.ai_opinion.join("\n")
  : "";


applyJeonseTotalRiskStyle(resultBox, riskLevel);

if (riskLevel === "safe") {

  resultMessage.innerHTML =
    "안전: 깡통전세 위험이 낮습니다.<br>그래도 등기부등본 확인을 권장합니다.";

} else if (riskLevel === "warning") {

  resultMessage.innerHTML =
    "주의: 추가 확인이 필요합니다.<br>등기부등본과 선순위채권을 확인해주세요.";

} else if (riskLevel === "danger") {

  resultMessage.innerHTML =
    "위험: 깡통전세 위험이 높습니다.<br>계약 전 반드시 추가 확인이 필요합니다.";

} else {

  resultMessage.innerHTML =
    "판단 불가: 거래 데이터가 부족하거나 분석이 어렵습니다.";

}


renderJeonseResultDetails(data, riskLevel, aiOpinion);
    } catch (error) {
  console.error(error);

  applyJeonseTotalRiskStyle(
    resultBox,
    "danger"
  );

  resultMessage.innerText =
    "오류 발생";

  resultDetails.innerText =
    error.message ||
    "알 수 없는 오류가 발생했습니다.";
}
  }
  
  function applyJeonseTotalRiskStyle(resultBox, riskLevel) {
    const style = getJeonseTotalRiskStyle(riskLevel);

    resultBox.className = riskLevel || "unknown";
    resultBox.style.background = style.background;
    resultBox.style.color = style.color;
    resultBox.style.border = `1px solid ${style.border}`;
  }

  
  function getJeonseTotalRiskStyle(riskLevel) {
    const styles = {
      safe: {
        background: "#dcfce7",
        color: "#166534",
        border: "#bbf7d0"
      },
      danger: {
        background: "#fee2e2",
        color: "#991b1b",
        border: "#fecaca"
      },
      warning: {
        background: "#ffedd5",
        color: "#9a3412",
        border: "#fed7aa"
      },
      unknown: {
        background: "#e5e7eb",
        color: "#374151",
        border: "#d1d5db"
      }
    };

    return styles[riskLevel] || styles.unknown;
  }

 
  function renderJeonseResultDetails(data, riskLevel, aiOpinion) {
    const resultBox = document.getElementById("resultBox");
    const resultDetails = document.getElementById("resultDetails");
    const totalLabel = getJeonseRiskLabel("total", riskLevel);
    const opinionHtml = aiOpinion
      ? escapeHtml(aiOpinion).replace(/\n/g, "<br>")
      : "\u0041\u0049 \uC758\uACAC\uC774 \uC81C\uACF5\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.";

    if (resultBox) {
      applyJeonseTotalRiskStyle(resultBox, riskLevel);
    }

    resultDetails.innerHTML = `
      <div>\uC885\uD569 \uC704\uD5D8\uB3C4: ${escapeHtml(totalLabel)}</div>
      <br>
      <div>${opinionHtml}</div>
    `;

    setupJeonseDetailView(data);
  }

 
  function setupJeonseDetailView(data) {
    const detailView = document.getElementById("jeonseDetailView");
    const toggleButton = document.getElementById("jeonseDetailToggleButton");

    if (detailView) {
      detailView.style.display = "none";
      detailView.innerHTML = createJeonseDetailHtml(data);
    }

   if (toggleButton) {

  toggleButton.style.display =
    "block";

  toggleButton.onclick =
    toggleJeonseDetailView;

  toggleButton.innerText =
    "상세보기";
}
  window.scrollTo(0, 0);
  }

  
  function toggleJeonseDetailView() {
    const detailView = document.getElementById("jeonseDetailView");
    const toggleButton = document.getElementById("jeonseDetailToggleButton");

    if (!detailView) return;

    const isHidden = detailView.style.display === "none";
    detailView.style.display = isHidden ? "block" : "none";

    if (toggleButton) {
      toggleButton.innerText = isHidden
        ? "\uC0C1\uC138\uB2EB\uAE30"
        : "\uC0C1\uC138\uBCF4\uAE30";
    }
  }

  
  function createJeonseDetailHtml(data) {
    const rows = [
      {
        title: "\u0048\u0055\u0047 \uC804\uC138\uBCF4\uC99D\uBCF4\uD5D8",
        type: "hug",
        analysis: data.hug_analysis
      },
      {
        title: "\uAE61\uD1B5\uC804\uC138 \uC704\uD5D8",
        type: "market",
        analysis: data.market_analysis
      },
      {
        title: "\uC2DC\uC138 \uC801\uC815\uC131",
        type: "rent",
        analysis: data.rent_analysis
      }
    ];

    return rows
      .map(item => {
        const riskLevel = item.analysis?.risk_level || "unknown";
        const riskLabel = getJeonseRiskLabel(item.type, riskLevel);
        const opinions = Array.isArray(item.analysis?.opinion)
          ? item.analysis.opinion
          : [];
        const opinionHtml = opinions.length > 0
          ? `<ul style="margin:8px 0 0 18px; padding:0;">${opinions
              .map(opinion => `<li>${escapeHtml(opinion)}</li>`)
              .join("")}</ul>`
          : `<p style="margin:8px 0 0;">\uD310\uB2E8 \uADFC\uAC70\uAC00 \uC81C\uACF5\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</p>`;

        return `
          <div style="margin-top:12px;">
            <strong>${escapeHtml(item.title)}:</strong>
            ${createJeonseRiskBadge(item.type, riskLevel, riskLabel)}
            ${opinionHtml}
          </div>
        `;
      })
      .join("");
  }

  
  function createJeonseRiskBadge(type, riskLevel, label) {
    const style = getJeonseRiskBadgeStyle(type, riskLevel);

    return `
      <span
        style="
          display:inline-block;
          margin-left:6px;
          padding:3px 8px;
          border-radius:999px;
          font-size:13px;
          font-weight:700;
          background:${style.background};
          color:${style.color};
          border:1px solid ${style.border};
          vertical-align:middle;
        "
      >
        ${escapeHtml(label)}
      </span>
    `;
  }

  
  function getJeonseRiskBadgeStyle(type, riskLevel) {
    if (
      riskLevel === "safe" ||
      riskLevel === "fair" ||
      riskLevel === "underpriced"
    ) {
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "#86efac"
      };
    }

    if (
      riskLevel === "danger"
    ) {
      return {
        background: "#fee2e2",
        color: "#991b1b",
        border: "#fecaca"
      };
    }

    if (
      riskLevel === "warning" ||
      riskLevel === "overpriced"
    ) {
      return {
        background: "#fef3c7",
        color: "#92400e",
        border: "#fde68a"
      };
    }

    return {
      background: "#e5e7eb",
      color: "#374151",
      border: "#d1d5db"
    };
  }

 
  function getJeonseRiskLabel(type, riskLevel) {
    const labels = {
      hug: {
        safe: "\uBCF4\uD5D8\uAC00\uC785\uAC00\uB2A5",
        danger: "\uBCF4\uD5D8\uAC00\uC785\uBD88\uAC00",
        unknown: "\uD310\uB2E8\uBD88\uAC00"
      },
      market: {
        safe: "\uC548\uC804",
        warning: "\uC8FC\uC758",
        danger: "\uC704\uD5D8",
        unknown: "\uD310\uB2E8\uBD88\uAC00"
      },
      rent: {
        underpriced: "\uC2DC\uC138\uBCF4\uB2E4\uB0AE\uC74C",
        fair: "\uC2DC\uC138\uB300\uBE44 \uC801\uC808",
        overpriced: "\uC2DC\uC138\uB300\uBE44\uB192\uC74C",
        unknown: "\uD310\uB2E8\uBD88\uAC00"
      },
      total: {
        safe: "\uC548\uC804",
        warning: "\uC8FC\uC758",
        danger: "\uC704\uD5D8",
        unknown: "\uD310\uB2E8\uBD88\uAC00"
      }
    };

    return labels[type]?.[riskLevel] || labels[type]?.unknown || "\uD310\uB2E8\uBD88\uAC00";
  }

  function formatNumber(input) {
    const value = input.value.replace(/[^0-9]/g, "");

    input.value = value
      ? parseInt(value, 10).toLocaleString("ko-KR")
      : "";
  }

  function openDetailModal(result) {

    document.getElementById("modalTitle").innerText =
      `${result.clause_no}번 조항`;

    document.getElementById("modalReason").innerHTML =
      `<h4>AI 분석 사유</h4>
      <p>${escapeHtml(result.reason || "")}</p>`;

    document.getElementById("modalStatutes").innerHTML =
      result.extra_statutes &&
      result.extra_statutes.length > 0
        ? `
        <h4>관련 법령</h4>
        <p>${escapeHtml(result.extra_statutes.join(", "))}</p>
        `
        : "";

    document.getElementById("detailModal").style.display =
      "flex";
  }

  function closeDetailModal() {

    document.getElementById("detailModal").style.display =
      "none";
  } 

 async function retryClauseAnalyze(
  event,
  clauseNo,
  button
) {

  event.stopPropagation();

  button.disabled = true;
  button.innerText = "재분석 중...";

  const target =
    currentClauses.find(
      v => v.id === clauseNo
    );

  if (!target) {

    button.disabled = false;
    button.innerText = "다시 분석";

    return;
  }

  try {

    const response =
      await fetchWithTimeout(
        CLAUSE_ANALYZE_API_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            id: target.id,
            special_clause:
              target.clause
          })
        }
      );

    const result =
      await response.json();

    if (result.detail) {

      updateResultCard({
        clause_no: target.id,
        content: target.clause,
        risk: "error",
        reason: getErrorMessage(
          result,
          "분석 중 오류 발생"
        ),
        extra_statutes: []
      });

      return;
    }

    const converted =
      convertServerResult(
        result,
        target
      );

    updateResultCard(
      converted
    );

  } catch (error) {

    updateResultCard({
      clause_no: target.id,
      content: target.clause,
      risk: "error",
      reason:
        error.message ||
        "분석 중 오류 발생",
      extra_statutes: []
    });

  }

}

function resetJeonseForm() {

  document.getElementById("buildingType").value =
    "아파트";

  document.getElementById("area").value = "";
  document.getElementById("deposit").value = "";
  document.getElementById("address").value = "";
  document.getElementById("dongNum").value = "";
  document.getElementById("hoNum").value = "";
  document.getElementById("priorBonds").value = "";

  selectedLawdCode = "";
  selectedAddressPayload = null;

  document.getElementById("resultBox").style.display =
    "none";

  const detailView =
    document.getElementById("jeonseDetailView");

  if (detailView) {
    detailView.style.display = "none";
    detailView.innerHTML = "";
  }

  const toggleButton =
    document.getElementById("jeonseDetailToggleButton");

  if (toggleButton) {

  toggleButton.style.display =
    "none";

  toggleButton.innerText =
    "상세보기";
}

}
