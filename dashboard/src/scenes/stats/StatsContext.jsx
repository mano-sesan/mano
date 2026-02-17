import { createContext, useContext } from "react";

const StatsContext = createContext({ v2: false });

export const useStatsContext = () => useContext(StatsContext);
export const StatsV2Provider = ({ children }) => <StatsContext.Provider value={{ v2: true }}>{children}</StatsContext.Provider>;
