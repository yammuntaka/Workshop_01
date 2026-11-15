import { loadDashboardData } from "./data-service.js";

(function () {
  const chartColors = ["#7158e8", "#41c8a0", "#ffb84d", "#3b82d4", "#e879a8", "#78909c", "#8c70e8", "#96a1b3"];
  const toast = document.getElementById("toast");
  let toastTimer;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove("show"); }, 2600);
  }

  function setWindowsUser(user) {
    const displayName = user.displayName || user.name || user.username;
    if (!displayName) {
      throw new Error("Windows authentication returned no user name");
    }
    document.getElementById("userName").textContent = displayName;
    document.getElementById("userRole").textContent = user.role || "บัญชี Windows";
    const accountName = displayName.split("\\").pop();
    document.getElementById("userAvatar").textContent = accountName
      .split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map(function (part) { return part.charAt(0); }).join("").toUpperCase() || "U";
  }

  function loadWindowsUser() {
    return fetch("/api/user", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Windows authentication returned HTTP " + response.status);
        }
        return response.json();
      })
      .then(setWindowsUser);
  }

  function renderMetrics(data) {
    document.getElementById("metricSkuCount").textContent = data.formatNumber(data.skuCount);
    document.getElementById("metricSkuFoot").textContent = data.formatNumber(data.materialCount) + " Material SAP";
    document.getElementById("metricProductIds").textContent = data.formatNumber(data.productIdCount);
    document.getElementById("metricProductIdsFoot").textContent = "จาก " + data.formatNumber(data.skuCount) + " SKU";
    document.getElementById("metricLatestSdq").textContent = data.formatNumber(data.latestSdq);
    document.getElementById("metricLatestSsq").textContent = data.formatNumber(data.latestSsq);
    setChange("metricSdqChange", data.latestSdq, data.initialSdq);
    document.getElementById("metricSsqFoot").textContent = "SSQ Estimation: " + data.formatNumber(data.ssqEstimation);
    document.getElementById("dataSource").textContent = "ที่มา: " + data.sourceFile + " · " + data.formatNumber(data.skuCount) + " SKU";
    document.getElementById("dataPeriod").textContent = data.period || "ไม่ระบุช่วงข้อมูล";
  }

  function setChange(elementId, current, previous) {
    const element = document.getElementById(elementId);
    if (!previous) {
      element.textContent = "ไม่มีฐานเปรียบเทียบ";
      element.classList.remove("growth", "decline");
      return;
    }
    const change = ((current - previous) / previous) * 100;
    element.textContent = (change >= 0 ? "↗ " : "↘ ") + Math.abs(change).toFixed(1) + "%";
    element.classList.toggle("growth", change >= 0);
    element.classList.toggle("decline", change < 0);
  }

  function makeElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function renderCategories(categories, formatNumber) {
    const container = document.getElementById("categoryChart");
    container.replaceChildren();
    const maxValue = Math.max.apply(null, categories.map(function (category) { return category.latestSsq; })) || 1;
    categories.forEach(function (category, index) {
      const row = makeElement("div", "category-row");
      row.setAttribute("aria-label", category.name + ": Latest SSQ " + formatNumber(category.latestSsq));
      row.appendChild(makeElement("span", "category-name", category.name));
      const track = makeElement("div", "category-track");
      const bar = makeElement("div", "category-bar");
      bar.style.width = (category.latestSsq / maxValue * 100) + "%";
      bar.style.setProperty("--chart-color", chartColors[index % chartColors.length]);
      track.appendChild(bar);
      row.appendChild(track);
      const value = makeElement("span", "category-value", formatNumber(category.latestSsq));
      value.appendChild(makeElement("small", "", formatNumber(category.skuCount) + " SKU"));
      row.appendChild(value);
      container.appendChild(row);
    });
  }

  function renderStatuses(statuses, total, formatNumber) {
    const donut = document.getElementById("statusDonut");
    const breakdown = document.getElementById("statusBreakdown");
    const segments = [];
    let start = 0;
    statuses.forEach(function (status, index) {
      const end = start + status.skuCount / total * 100;
      segments.push(chartColors[index % chartColors.length] + " " + start + "% " + end + "%");
      start = end;
    });
    donut.style.setProperty("--donut-gradient", "conic-gradient(" + segments.join(", ") + ")");
    donut.setAttribute("aria-label", statuses.map(function (status) {
      return status.name + " " + formatNumber(status.skuCount) + " SKU";
    }).join(", "));
    document.getElementById("statusTotal").textContent = formatNumber(total);
    breakdown.replaceChildren();
    statuses.forEach(function (status, index) {
      const row = makeElement("div", "breakdown-row");
      const swatch = makeElement("i");
      swatch.style.setProperty("--chart-color", chartColors[index % chartColors.length]);
      row.appendChild(swatch);
      row.appendChild(makeElement("span", "", status.name));
      row.appendChild(makeElement("b", "", formatNumber(status.skuCount)));
      breakdown.appendChild(row);
    });
  }

  function renderLaunches(launches, formatNumber) {
    const chart = document.getElementById("launchChart");
    chart.replaceChildren();
    const maxCount = Math.max.apply(null, launches.map(function (launch) { return launch.skuCount; })) || 1;
    launches.forEach(function (launch, index) {
      const column = makeElement("div", "launch-column");
      column.appendChild(makeElement("span", "launch-value", formatNumber(launch.skuCount)));
      const track = makeElement("div", "launch-track");
      const bar = makeElement("div", "launch-bar");
      bar.style.setProperty("--bar-height", (launch.skuCount / maxCount * 100) + "%");
      bar.style.backgroundColor = chartColors[index % chartColors.length];
      track.appendChild(bar);
      column.appendChild(track);
      column.appendChild(makeElement("span", "launch-label", launch.name));
      chart.appendChild(column);
    });
  }

  function renderTopProducts(products, formatNumber) {
    const container = document.getElementById("topProducts");
    container.replaceChildren();
    products.forEach(function (product, index) {
      const item = makeElement("div", "activity-item");
      item.appendChild(makeElement("span", "activity-symbol", String(index + 1)));
      const copy = makeElement("span", "activity-copy");
      const name = makeElement("strong", "", product.SkuName || product.ProductId);
      name.title = product.SkuName || product.ProductId;
      copy.appendChild(name);
      copy.appendChild(makeElement("small", "", [product.Family, product.Category].filter(Boolean).join(" · ")));
      item.appendChild(copy);
      item.appendChild(makeElement("span", "activity-number", formatNumber(Number(product.LatestSsq) || 0)));
      container.appendChild(item);
    });
  }

  function renderDashboard(data) {
    renderMetrics(data);
    renderCategories(data.categories, data.formatNumber);
    renderStatuses(data.statuses, data.skuCount, data.formatNumber);
    renderLaunches(data.launches, data.formatNumber);
    renderTopProducts(data.topProducts, data.formatNumber);
  }

  loadWindowsUser().catch(function (error) {
    console.error("Windows authentication failed:", error);
    document.getElementById("userName").textContent = "ยืนยันตัวตนไม่สำเร็จ";
    document.getElementById("userRole").textContent = "Windows Authentication";
    document.getElementById("userAvatar").textContent = "!";
    showToast("ไม่สามารถยืนยันตัวตน Windows ได้ กรุณาตรวจสอบเครือข่ายหรือสิทธิ์");
  });

  loadDashboardData().then(renderDashboard).catch(function (error) {
    console.error("Product dashboard data failed to load:", error);
    document.getElementById("dataSource").textContent = "โหลดข้อมูลสินค้าไม่สำเร็จ";
    showToast("ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาตรวจสอบไฟล์ต้นทาง");
  });

  document.getElementById("menuToggle").addEventListener("click", function () { document.getElementById("sidebar").classList.toggle("open"); });
}());
