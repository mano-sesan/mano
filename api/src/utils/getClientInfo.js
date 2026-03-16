function getClientInfo(req) {
  const userAgent = req.headers["user-agent"] || null;
  return {
    ip: req.ip || null,
    userAgent: userAgent ? userAgent.slice(0, 512) : null,
  };
}

module.exports = getClientInfo;
