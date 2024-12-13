import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useRestoreScrollPosition() {
  const { pathname } = useLocation();

  useEffect(() => {
    const scrollParent = document.querySelector("#main-content")!;
    const scrollPosition = localStorage.getItem(`scrollPosition-${pathname}`);
    if (scrollPosition) {
      scrollParent.scrollTo(0, parseInt(scrollPosition));
    }
    function handleSaveScrollPosition() {
      localStorage.setItem(`scrollPosition-${pathname}`, scrollParent.scrollTop.toString());
    }
    document.querySelector("#main-content").addEventListener("scrollend", handleSaveScrollPosition);
    return () => {
      document.querySelector("#main-content").removeEventListener("scrollend", handleSaveScrollPosition);
    };
  }, [pathname]);
}
