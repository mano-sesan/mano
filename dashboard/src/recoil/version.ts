import { atom } from "jotai";
import { dayjsInstance } from "../services/date";

// Using explicit type assertion for writable atoms
export const deploymentDateState = atom<string | null>(null);
export const deploymentCommitState = atom<string | null>(null);

// Derived atom for short commit SHA
export const deploymentShortCommitSHAState = atom((get) => {
  const fullSHA = get(deploymentCommitState);
  return (fullSHA || "-").substring(0, 7);
});

// Derived atom to determine if we should show outdated alert
export const showOutdateAlertBannerState = atom((get) => {
  const deploymentCommit = get(deploymentCommitState);
  const deploymentDate = get(deploymentDateState);
  if (!deploymentCommit || !deploymentDate) return false;
  return (
    dayjsInstance(deploymentDate).isAfter(dayjsInstance(window.localStorage.getItem("deploymentDate"))) &&
    deploymentCommit !== window.localStorage.getItem("deploymentCommit")
  );
});
