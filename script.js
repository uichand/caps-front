  let selectedImage = null;
  let selectedLawdCode = "";
  let selectedAddressPayload = null; // image.png 스키마에 맞춰 백엔드로 보낼 주소 상세값 저장

  const BASE_API_URL =
    "https://stockinged-lakita-dowable.ngrok-free.dev";

  const OCR_API_URL =
    BASE_API_URL + "/api/v1/extract/image";

  const CLAUSE_ANALYZE_API_URL =
    BASE_API_URL + "/api/v1/analyze/clause";

  const JEONSE_API_URL =
    BASE_API_URL + "/api/v1/analyze/property-risk/ai";
    
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
    statusMsg.innerText = "서버에서 OCR 추출 중...";

    const formData = new FormData();
    formData.append("image", selectedImage);

    try {
      const response = await fetch(OCR_API_URL, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("OCR 서버 응답 오류");
      }

      const data = await response.json();

      let clauses = [];

      if (Array.isArray(data)) {
        clauses = data;
      } else if (Array.isArray(data.clauses)) {
        clauses = splitClausesByPeriod(data.clauses.join(" "));
      } else if (typeof data.text === "string") {
        clauses = splitClausesByPeriod(data.text);
      } else if (typeof data.ocr_text === "string") {
        clauses = splitClausesByPeriod(data.ocr_text);
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

    } catch (error) {
      console.error(error);
      alert("OCR 서버 통신 오류입니다.");
    } finally {
      popup.style.display = "none";
    }
  }

  async function analyzeDirectText() {
    const text = document.getElementById("directText").value.trim();

    if (!text) {
      alert("분석할 특약사항을 입력해주세요.");
      return;
    }

    const clauses = splitClausesByPeriod(text).map((content, index) => ({
      id: index + 1,
      clause: content
    }));

    await sendClausesToServer(clauses);
  }

  function splitClausesByPeriod(text) {
    const cleaned = text
      .replace(/\r/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

      const removedNumber = cleaned.replace(
    /\b\d+\.\s*/g,
    ""
  ); 

    return removedNumber
      .split(/(?<=\.)/)
      .map(v => v.trim())
      .filter(v => v.length > 0)
      .map(v => v.endsWith(".") ? v : v + ".");
  }

  async function sendClausesToServer(clauses) {

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
          await fetch(
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
          risk: "unknown",
          reason:
            "분석 중 오류 발생",
          extra_statutes: []
        });

      }

    });

  }
  async function sendClausesToServer(clauses) {

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
          await fetch(
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
          risk: "unknown",
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

    const div =
      document.getElementById(
        `result-card-${result.clause_no}`
      );

    if (!div) return;

    let label =
      "판단불가";

    let badgeBg =
      "#e5e7eb";

    let badgeColor =
      "#374151";

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
      label = "판단불가";
      badgeBg = "#e5e7eb";
      badgeColor = "#374151";
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

  // ===== 깡통전세 기능은 기존 코드 유지 =====

  function execDaumPostcode() {
    new daum.Postcode({
      oncomplete: data => {
        const addressInput = document.getElementById("address");

        addressInput.value =
          data.roadAddress || data.jibunAddress;

        if (data.bcode) {
          selectedLawdCode = data.bcode.substring(0, 5);
        }

        selectedAddressPayload = createAddressPayload(data); // 카카오 주소 결과를 백엔드 전송 형식으로 변환
      }
    }).open();
  }

  function createAddressPayload(data) { // image.png에 나온 주소 관련 필드 생성
    const jibun = extractJibun(data.jibunAddress || data.autoJibunAddress || ""); // 전체 지번 추출
    const [mainJibun, subJibun = "0"] = jibun.split("-"); // 본번/부번 분리

    return {
      dong_name: data.bname || "", // 법정동 이름
      legal_dong_code: data.bcode || "", // 법정동코드 10자리
      jibun: jibun, // 지번
      main_jibun: mainJibun || "", // 지번 본번
      sub_jibun: subJibun || "0", // 지번 부번, 없으면 0
      mountain_yn: isMountainJibun(data.jibunAddress || data.autoJibunAddress || "") ? "Y" : "N" // 산 여부
    };
  }

  function extractJibun(jibunAddress) { // 지번 주소에서 532 또는 532-1 형태만 추출
    const match = jibunAddress.match(/(?:산\s*)?(\d{1,4}(?:-\d{1,4})?)/);

    return match ? match[1] : "";
  }

  function isMountainJibun(jibunAddress) { // 지번 앞에 산이 있으면 Y로 보내기 위한 판별
    return /(?:^|\s)산\s*\d/.test(jibunAddress);
  }

  function promptNumberValue(label) { // 동 번호/호 번호를 숫자 형식으로 입력받기
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
    );

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

    if (!selectedAddressPayload || !selectedAddressPayload.legal_dong_code) { // 주소 상세값이 없으면 전송 중단
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
    resultBox.className = "unknown";

    resultMessage.innerText = "국토부 실거래가 분석 중...";
    resultDetails.innerText = "";

    try {
      const response = await fetch(
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
            dong_num: dongNum, // 동 번호
            ho_num: hoNum, // 호 번호
            dong_name: selectedAddressPayload.dong_name, // 법정동 이름
            legal_dong_code: selectedAddressPayload.legal_dong_code, // 법정동코드
            jibun: selectedAddressPayload.jibun, // 지번
            main_jibun: selectedAddressPayload.main_jibun, // 지번 본번
            sub_jibun: selectedAddressPayload.sub_jibun, // 지번 부번
            mountain_yn: selectedAddressPayload.mountain_yn,
            prior_bonds: priorBonds
            
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();

     const riskLevel = data.total_risk_level;
const aiOpinion = Array.isArray(data.ai_opinion)
  ? data.ai_opinion.join("\n")
  : "";

if (riskLevel === "safe") {
  resultBox.className = "safe";

  resultMessage.innerHTML =
    "안전: 깡통전세 위험이 낮습니다.<br>그래도 등기부등본 확인을 권장합니다.";
} else {
  resultBox.className = "danger";

  resultMessage.innerHTML =
    "주의: 깡통전세 위험 가능성이 있습니다.<br>등기부등본과 선순위채권 확인이 필요합니다.";
}

resultDetails.innerText =
  `종합 위험도: ${riskLevel || "unknown"}\n\n${aiOpinion}`;
    } catch (error) {
      console.error(error);

      resultBox.className = "danger";

      resultMessage.innerText = "서버 통신 오류";

      resultDetails.innerText =
        "FastAPI 서버가 실행 중인지 확인해주세요.";
    }
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
