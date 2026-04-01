import { useIsFocused } from "@react-navigation/native";
import { useEffect } from "react";
import { refreshTriggerState } from "../components/Loader";
import { useAtom } from "jotai";

export default function useRefreshOnFocus() {
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused && refreshTrigger.status !== true) {
      requestIdleCallback(() => {
        setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);
}
