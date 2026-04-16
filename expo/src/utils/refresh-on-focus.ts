import { useDataLoader } from "@/services/dataLoader";
import { useIsFocused } from "@react-navigation/native";
import { useEffect } from "react";

export default function useRefreshOnFocus() {
  const isFocused = useIsFocused();
  const { refresh, isLoading } = useDataLoader();
  useEffect(() => {
    if (isFocused && !isLoading) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);
}
