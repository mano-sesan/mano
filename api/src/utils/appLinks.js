function getAppLinks(version, packageId) {
  if (packageId === "com.sesan.mano.niort") {
    return {
      downloadLink: `https://mano.sesan.fr/download-niort?ts=${Date.now()}`,
      installLink: `https://github.com/mano-sesan/mano/releases/download/niort${version}/mano-niort.apk`,
    };
  }
  if (packageId === "com.sesan.mano.nantes") {
    return {
      downloadLink: `https://mano.sesan.fr/download-nantes?ts=${Date.now()}`,
      installLink: `https://github.com/mano-sesan/mano/releases/download/nantes${version}/mano-nantes.apk`,
    };
  }
  return {
    downloadLink: `https://mano.sesan.fr/download?ts=${Date.now()}`,
    installLink: `https://github.com/mano-sesan/mano/releases/download/m${version}/mano-standard.apk`,
  };
}

module.exports = {
  getAppLinks,
};
