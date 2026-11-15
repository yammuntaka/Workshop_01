const formatNumber = new Intl.NumberFormat("en-US");

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(products, field) {
  return products.reduce(function (total, product) {
    return total + numberOrZero(product[field]);
  }, 0);
}

function groupProducts(products, field) {
  const groups = new Map();
  products.forEach(function (product) {
    const name = product[field] || "ไม่ระบุ";
    let group = groups.get(name);
    if (!group) {
      group = { name: name, skuCount: 0, latestSsq: 0 };
      groups.set(name, group);
    }
    group.skuCount += 1;
    group.latestSsq += numberOrZero(product.LatestSsq);
  });
  return Array.from(groups.values());
}

export async function loadDashboardData() {
  const response = await fetch("/data/products.json", {
    credentials: "same-origin",
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("Product data returned HTTP " + response.status);
  }

  const catalog = await response.json();
  if (!catalog || !Array.isArray(catalog.Products) || catalog.Products.length === 0) {
    throw new Error("The product catalog is empty or invalid");
  }

  const products = catalog.Products;
  const productIds = new Set(products.map(function (product) { return product.ProductId; }).filter(Boolean));
  const materials = new Set(products.map(function (product) { return product.MaterialNumber; }).filter(Boolean));
  const periods = Array.from(new Set(products.map(function (product) {
    return [product.Year, product.SeasonType].filter(Boolean).join(" · ");
  }).filter(Boolean)));
  const categories = groupProducts(products, "Category").sort(function (a, b) { return b.latestSsq - a.latestSsq; });
  const statuses = groupProducts(products, "DevelopmentStatus").sort(function (a, b) { return b.skuCount - a.skuCount; });
  const launches = groupProducts(products, "Launch").sort(function (a, b) { return b.skuCount - a.skuCount; });
  const topProducts = products.slice().sort(function (a, b) {
    return numberOrZero(b.LatestSsq) - numberOrZero(a.LatestSsq);
  }).slice(0, 5);

  return {
    sourceFile: catalog.SourceFile || "Product SKUs.xlsx",
    skuCount: products.length,
    productIdCount: productIds.size,
    materialCount: materials.size,
    initialSdq: sum(products, "InitialSdq"),
    latestSdq: sum(products, "LatestSdq"),
    ssqEstimation: sum(products, "SsqEstimation"),
    latestSsq: sum(products, "LatestSsq"),
    period: periods.join(", "),
    categories: categories,
    statuses: statuses,
    launches: launches,
    topProducts: topProducts,
    formatNumber: function (value) { return formatNumber.format(value); }
  };
}
