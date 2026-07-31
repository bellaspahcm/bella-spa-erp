(() => {
  try {
    const path = window.location.pathname || "";
    
    // Skip theme bootstrap for auth pages (login, signup)
    if (path === "/login" || path.startsWith("/login/") || 
        path === "/signup" || path.startsWith("/signup/") ||
        path.includes("/(auth)/")) {
      return; // Keep default pink gradient for auth pages
    }
    
    const isAppShell =
      path === "/dashboard" ||
      path.startsWith("/dashboard/") ||
      path === "/ktv" ||
      path.startsWith("/ktv/");

    if (!isAppShell) return;

    const root = document.documentElement;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const setThemeColor = (color) => {
      if (themeMeta) themeMeta.setAttribute("content", color);
    };
    const setRootVars = (vars) => {
      Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    };

    root.dataset.tenantModule = "pending";
    setRootVars({
      "--primary": "#334155",
      "--primary-hover": "#1e293b",
      "--accent": "#94a3b8",
      "--background": "#f8fafc",
      "--foreground": "#0F172A",
      "--border": "#e2e8f0",
      "--input": "#e2e8f0",
      "--ring": "#64748b",
    });
    setThemeColor("#f8fafc");

    // Restore cached tenant brand identity from session/local storage for zero-flash first paint
    try {
      const cachedStr = window.sessionStorage.getItem("bella.runtime.brand.v1") || window.localStorage.getItem("bella.sidebar.brand.v2");
      if (cachedStr) {
        const brand = JSON.parse(cachedStr);
        if (brand && brand.moduleKey) {
          root.dataset.tenantModule = brand.moduleKey;
          if (brand.buttonStyle) root.dataset.tenantBrandButton = brand.buttonStyle;
          if (brand.menuStyle) root.dataset.tenantBrandMenu = brand.menuStyle;
          if (brand.radiusStyle) root.dataset.tenantBrandRadius = brand.radiusStyle;
          if (brand.primaryColor) {
            setRootVars({
              "--primary": brand.primaryColor,
              "--primary-hover": brand.primaryHoverColor || brand.primaryColor,
              "--accent": brand.accentColor || brand.primaryColor,
              "--ring": brand.primaryColor,
            });
            setThemeColor(brand.primaryColor);
          }
          if (brand.displayName) {
            document.title = `${brand.displayName} — ${brand.subtitle || "Management System"}`;
          }
        }
      }
    } catch (e) {}
  } catch {
    const path = window.location.pathname || "";
    if (
      path === "/dashboard" ||
      path.startsWith("/dashboard/") ||
      path === "/ktv" ||
      path.startsWith("/ktv/")
    ) {
      document.documentElement.dataset.tenantModule = "pending";
    }
  }
})();
