import { createContext, useContext } from "react";

const StatsContext = createContext({ compact: false });

export const useStatsContext = () => useContext(StatsContext);
export const StatsCompactProvider = ({ children }) => <StatsContext.Provider value={{ compact: true }}>{children}</StatsContext.Provider>;
