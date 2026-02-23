import { createContext, useContext } from "react";

const StatsContext = createContext({ isStatsV2: false });

export const useStatsContext = () => useContext(StatsContext);
export const StatsV2Provider = ({ children }) => <StatsContext.Provider value={{ isStatsV2: true }}>{children}</StatsContext.Provider>;
