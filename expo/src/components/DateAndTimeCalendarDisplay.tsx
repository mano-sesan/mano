import React from "react";
import styled from "styled-components/native";

import { MyText } from "./MyText";
import colors from "../utils/colors";
import { dayjsInstance } from "../services/dateDayjs";
import { Dayjs } from "dayjs";

type DateAndTimeCalendarDisplayProps = {
  date: Dayjs | null;
  withTime: boolean;
  topCaption?: string;
};

const DateAndTimeCalendarDisplay = ({ date, withTime, topCaption }: DateAndTimeCalendarDisplayProps) => {
  if (!date) return <DateContainer />;

  return (
    <DateContainer>
      {topCaption && <TopCaption>{topCaption}</TopCaption>}
      <Day>{date.format("dddd")}</Day>
      <DateNumber heavy>{date.format("D")}</DateNumber>
      <Month>{date.format("MMMM")}</Month>
      {date.format("YYYY") !== dayjsInstance().format("YYYY") && <Month>{date.format("YYYY")}</Month>}
      {!!withTime && <Time>{date.format("HH:mm")}</Time>}
    </DateContainer>
  );
};

const DateContainer = styled.View`
  flex-shrink: 0;
  flex-basis: 70px;
  /* border: 2px solid black; */
`;

const DateText = styled(MyText)`
  font-size: 12px;
  font-style: italic;
  text-align: center;
  text-transform: uppercase;
`;

const TopCaption = styled(MyText)`
  font-size: 12px;
  font-style: italic;
  text-align: center;
  margin-top: -15px;
  margin-bottom: 5px;
  opacity: 0.25;
`;

const Day = styled(DateText)`
  color: ${colors.app.color};
`;

const Time = styled(DateText)`
  margin-top: 10px;
`;

const Month = styled(DateText)`
  color: ${colors.app.secondary};
`;

const DateNumber = styled(MyText)`
  font-size: 20px;
  font-style: italic;
  text-align: center;
  margin-vertical: 5px;
`;

export default DateAndTimeCalendarDisplay;
