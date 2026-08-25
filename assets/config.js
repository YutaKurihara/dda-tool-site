/*
 * DDA Tool site — Earth Engine App URLs.
 *
 * THIS IS THE ONLY FILE YOU NEED TO EDIT after publishing the apps.
 *
 * How to publish (once, from the GEE Code Editor):
 *   1. Open the script (03_dashboard/01_dashboard.js or 01_shared/07_datacheck.js)
 *   2. Apps button (top toolbar) -> NEW APP -> pick a name -> Publish
 *   3. Copy the app URL, e.g.
 *      https://ee-kurihara-yt.projects.earthengine.app/view/dda-dashboard
 *   4. Paste it below.
 *
 * Leave a URL empty ("") and the page shows publish instructions instead
 * of a broken iframe.
 */
window.DDA_APPS = {
  dashboard: "https://ee-kurihara-yt.projects.earthengine.app/view/dashboard",
  datacheck: "https://ee-kurihara-yt.projects.earthengine.app/view/datacheck",
  forestfire: "https://ee-kurihara-yt.projects.earthengine.app/view/forestfire",
};

/* Injects the iframe (or a placeholder card) into #app-slot. */
window.mountApp = function (key) {
  var slot = document.getElementById("app-slot");
  if (!slot) return;
  var url = (window.DDA_APPS || {})[key] || "";
  if (url) {
    var f = document.createElement("iframe");
    f.src = url;
    f.allow = "fullscreen";
    f.loading = "lazy";
    slot.appendChild(f);
  } else {
    slot.innerHTML =
      '<div class="app-placeholder"><div class="inner">' +
      "<h2 style='margin-top:0;border:none;padding:0'>App not published yet</h2>" +
      "<p>This page embeds a Google Earth Engine App. To activate it:</p>" +
      "<ol>" +
      "<li>Open the script in the GEE Code Editor</li>" +
      "<li><b>Apps &rarr; NEW APP &rarr; Publish</b></li>" +
      "<li>Paste the app URL into <code>site/assets/config.js</code> " +
      "(key: <code>" + key + "</code>)</li>" +
      "</ol></div></div>";
  }
};
