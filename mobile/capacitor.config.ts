// capacitor.config.ts
const config = {
  appId: "com.atomprotect.admin",
  appName: "AtomProtect",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
