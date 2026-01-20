const { AsyncLocalStorage } = require("node:async_hooks");

// Per-request storage for things we don't want to thread through every call.
// Store shape: Map<string, any>
const asyncLocalStorage = new AsyncLocalStorage();

function runWithRequestContext(fn) {
  return asyncLocalStorage.run(new Map(), fn);
}

function setRequestUser(user) {
  const store = asyncLocalStorage.getStore();
  if (!store) return;
  store.set("user", user);
}

function getRequestUser() {
  return asyncLocalStorage.getStore()?.get("user");
}

function getRequestUserId() {
  const user = getRequestUser();
  return user?._id;
}

module.exports = {
  asyncLocalStorage,
  runWithRequestContext,
  setRequestUser,
  getRequestUser,
  getRequestUserId,
};
