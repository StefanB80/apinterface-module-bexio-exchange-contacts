const { moduleManifest } = require("./moduleManifest");

function getModuleDefinition() {
  return {
    manifest: moduleManifest
  };
}

if (require.main === module) {
  console.log("apinterface-module-bexio-exchange-contacts");
  console.log(`Version: ${moduleManifest.version}`);
}

module.exports = getModuleDefinition();
