import { loadDashboardData } from "./data-service.js";

(function () {
  const chartColors = ["#7158e8", "#41c8a0", "#ffb84d", "#3b82d4", "#e879a8", "#78909c", "#8c70e8", "#96a1b3"];
  const toast = document.getElementById("toast");
  let toastTimer;
  const chartFont = '"Leelawadee UI", "Segoe UI", Tahoma, sans-serif';

  function getChartLibrary() {
    if (typeof window.Chart !== "function") {
      throw new Error("Chart.js failed to load from the local application files");
    }
    window.Chart.defaults.font.family = chartFont;
    window.Chart.defaults.font.size = 12;
    window.Chart.defaults.color = "#596579";
    return window.Chart;
  }

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
    document.getElementById("dataPeriod").textContent = data.period
      ? "ช่วงข้อมูล: " + data.period
      : "ไม่ระบุช่วงข้อมูล";
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

  function renderAccessibleRows(tableBodyId, rows, getValues) {
    const body = document.getElementById(tableBodyId);
    body.replaceChildren();
    rows.forEach(function (item) {
      const row = makeElement("tr");
      getValues(item).forEach(function (value, index) {
        const cell = makeElement(index === 0 ? "th" : "td", "", value);
        if (index === 0) {
          cell.setAttribute("scope", "row");
        }
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  }

  function renderCategories(categories, formatNumber) {
    const Chart = getChartLibrary();
    const categoryChart = document.getElementById("categoryChart");
    new Chart(categoryChart, {
      type: "bar",
      data: {
        labels: categories.map(function (category) { return category.name; }),
        datasets: [{
          label: "Latest SSQ",
          data: categories.map(function (category) { return category.latestSsq; }),
          backgroundColor: categories.map(function (_, index) { return chartColors[index % chartColors.length]; }),
          borderRadius: 5,
          maxBarThickness: 23
        }]
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return " " + formatNumber(context.parsed.x) + " · " +
                  formatNumber(categories[context.dataIndex].skuCount) + " SKU";
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: "#edf0f5" },
            ticks: { font: { size: 11 }, callback: function (value) { return formatNumber(value); } }
          },
          y: {
            border: { display: false },
            grid: { display: false },
            ticks: {
              autoSkip: false,
              font: { size: 12 },
              callback: function (value) {
                const label = this.getLabelForValue(value);
                return label.length > 22 ? label.slice(0, 21) + "…" : label;
              }
            }
          }
        }
      }
    });
    renderAccessibleRows("categoryDataTableBody", categories, function (category) {
      return [category.name, formatNumber(category.latestSsq), formatNumber(category.skuCount)];
    });
  }

  function renderStatuses(statuses, total, formatNumber) {
    const Chart = getChartLibrary();
    const breakdown = document.getElementById("statusBreakdown");
    const statusChart = document.getElementById("statusChart");
    new Chart(statusChart, {
      type: "doughnut",
      data: {
        labels: statuses.map(function (status) { return status.name; }),
        datasets: [{
          data: statuses.map(function (status) { return status.skuCount; }),
          backgroundColor: statuses.map(function (_, index) { return chartColors[index % chartColors.length]; }),
          borderColor: "#fff",
          borderWidth: 3,
          hoverOffset: 4
        }]
      },
      options: {
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                const count = Number(context.raw) || 0;
                const percentage = total ? (count / total * 100).toFixed(1) : "0.0";
                return " " + context.label + ": " + formatNumber(count) + " SKU (" + percentage + "%)";
              }
            }
          }
        }
      }
    });
    document.getElementById("statusTotal").textContent = formatNumber(total);
    document.getElementById("statusDataTableTotal").textContent = formatNumber(total);
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
    renderAccessibleRows("statusDataTableBody", statuses, function (status) {
      return [status.name, formatNumber(status.skuCount)];
    });
  }

  function renderLaunches(launches, formatNumber) {
    const Chart = getChartLibrary();
    const launchChart = document.getElementById("launchChart");
    new Chart(launchChart, {
      type: "bar",
      data: {
        labels: launches.map(function (launch) { return launch.name; }),
        datasets: [{
          label: "จำนวน SKU",
          data: launches.map(function (launch) { return launch.skuCount; }),
          backgroundColor: launches.map(function (_, index) { return chartColors[index % chartColors.length]; }),
          borderRadius: 5,
          maxBarThickness: 42
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) { return " " + formatNumber(context.parsed.y) + " SKU"; }
            }
          }
        },
        scales: {
          x: {
            border: { display: false },
            grid: { display: false },
            ticks: { font: { size: 12 } }
          },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: "#edf0f5" },
            ticks: {
              precision: 0,
              font: { size: 11 },
              callback: function (value) { return formatNumber(value); }
            }
          }
        }
      }
    });
    renderAccessibleRows("launchDataTableBody", launches, function (launch) {
      return [launch.name, formatNumber(launch.skuCount)];
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

  loadDashboardData().then(function (data) {
    try {
      renderDashboard(data);
    } catch (error) {
      console.error("Product dashboard rendering failed:", error);
      document.getElementById("dataSource").textContent = "แสดงข้อมูลแดชบอร์ดไม่สำเร็จ";
      showToast("ไม่สามารถแสดงแดชบอร์ดได้ กรุณาตรวจสอบข้อผิดพลาด");
    }
  }).catch(function (error) {
    console.error("Product dashboard data failed to load:", error);
    document.getElementById("dataSource").textContent = "โหลดข้อมูลสินค้าไม่สำเร็จ";
    showToast("ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาตรวจสอบไฟล์ต้นทาง");
  });

  document.getElementById("menuToggle").addEventListener("click", function () { document.getElementById("sidebar").classList.toggle("open"); });
}());
