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
          const LEGACY_DEFAULT_PINKS = ['#A91555', '#DB2777', '#F43F5E', '#BE123C', '#E11D48', '#881337', '#FF4081', '#E91E63', '#EC4899', '#C026D3', '#D946EF', '#9F1239'];
          let resolvedPreset = brand.stylePreset || (brand.primaryColor === '#074E44' ? 'jade_wellness' : brand.primaryColor === '#1E3A8A' ? 'luxury_navy' : brand.primaryColor === '#1E40AF' ? 'ocean_clean' : brand.primaryColor === '#18181B' ? 'graphite_luxe' : 'bella_rose');
          let primaryColor = brand.primaryColor;
          let primaryHoverColor = brand.primaryHoverColor || brand.primaryColor;
          let accentColor = brand.accentColor || brand.primaryColor;

          // If this is not babycare/beauty_spa, prevent any legacy pink brand styles
          if (brand.moduleKey !== 'babycare' && brand.moduleKey !== 'beauty_spa') {
            const isPinkTheme = (primaryColor && LEGACY_DEFAULT_PINKS.includes(primaryColor.toUpperCase())) || resolvedPreset === 'bella_rose';
            if (isPinkTheme) {
              resolvedPreset = brand.moduleKey === 'industrial_cleaning' ? 'ocean_clean' : 'luxury_navy';
              primaryColor = brand.moduleKey === 'industrial_cleaning' ? '#1E40AF' : '#1E3A8A';
              primaryHoverColor = brand.moduleKey === 'industrial_cleaning' ? '#153E90' : '#172554';
              accentColor = brand.moduleKey === 'industrial_cleaning' ? '#3B82F6' : '#D97706';
            }
          }

          root.dataset.tenantModule = brand.moduleKey;
          root.dataset.tenantBrandPreset = resolvedPreset;
          if (brand.buttonStyle) root.dataset.tenantBrandButton = brand.buttonStyle;
          if (brand.menuStyle) root.dataset.tenantBrandMenu = brand.menuStyle;
          if (brand.radiusStyle) root.dataset.tenantBrandRadius = brand.radiusStyle;
          if (primaryColor) {
            setRootVars({
              "--primary": primaryColor,
              "--primary-hover": primaryHoverColor,
              "--accent": accentColor,
              "--ring": primaryColor,
            });
            setThemeColor(primaryColor);
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
