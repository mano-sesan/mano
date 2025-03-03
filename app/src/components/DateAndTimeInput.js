import React from 'react';
import styled from 'styled-components/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Label from './Label';
import ButtonReset from './ButtonReset';
import InputLabelled from './InputLabelled';
import { MyText } from './MyText';
import { dayjsInstance } from '../services/dateDayjs';

// we want to show DD-MM-YYYY
// but we want to save as YYYY-MM-DD

// convert from DD-MM-YYYY to YYYY-MM-DD or the opposite is the same formula
export const convertDate = (date, showDay) => {
  try {
    if (!date) return '';
    return dayjsInstance(date).format('DD-MM-YYYY');
  } catch (e) {
    console.log('cannot convert date', e);
    console.log(date);
  }
};

const convertTime = (date) => {
  try {
    if (!date) return '';
    return dayjsInstance(date).format('HH:mm');
  } catch (e) {
    console.log('cannot convert date', e);
    console.log(date);
  }
};

const formatDate = (date, withTime) => {
  if (withTime) return date.toISOString();
  const newDate = new Date(date);
  newDate.setUTCHours(0);
  newDate.setUTCMinutes(0);
  newDate.setUTCSeconds(0);
  newDate.setUTCMilliseconds(0);
  return newDate.toISOString();
};

const DateAndTimeInput = ({
  required,
  withTime,
  setWithTime = () => null,
  label,
  date,
  editable = true,
  setDate,
  showTime,
  showDay,
  showYear = false,
  testID = '',
}) => {
  const [mode, setMode] = React.useState('date');
  const [visible, setVisible] = React.useState(false);

  const onDateChooseRequest = () => {
    setMode('date');
    setVisible(true);
  };

  const onTimeChooseRequest = () => {
    setMode('time');
    setVisible(true);
  };

  const setDateRequest = (newDate) => {
    setVisible(false);
    setDate(formatDate(newDate, withTime));
  };

  const onClearDate = () => {
    if (showTime) setWithTime(false);
    setDate('');
  };

  const onClose = () => setVisible(false);

  const setWithTimeRequest = () => {
    setWithTime(true);
    onTimeChooseRequest();
  };

  const unsetWithTimeRequest = () => {
    setWithTime(false);
    setDate(formatDate(date, false));
  };

  const renderTime = () => {
    if (!date?.length) return null;
    if (!showTime) return null;
    if (!withTime) {
      return (
        <WithTimeContainer onPress={setWithTimeRequest}>
          <WithTime>Préciser l'heure</WithTime>
        </WithTimeContainer>
      );
    }
    return (
      <>
        <WithTime>à</WithTime>
        <InputSubContainer onPress={onTimeChooseRequest}>
          <Input>{convertTime(date)}</Input>
          {!required && <ButtonReset onPress={unsetWithTimeRequest} />}
        </InputSubContainer>
      </>
    );
  };

  if (!editable) {
    const datetoShow = showDay
      ? dayjsInstance(date).format('dddd DD MMMM HH:mm')
      : `${date ? convertDate(date, showDay) : 'JJ-MM-AAAA'}${showTime && withTime ? ` à ${convertTime(date)}` : ''}`;
    return <InputLabelled label={label} value={datetoShow} editable={false} />;
  }

  const renderDate = () => {
    if (!date) return 'JJ-MM-AAAA';
    // eslint-disable-next-line eqeqeq
    if (new Date(date) == 'Invalid Date') return 'JJ-MM-AAAA';
    if (showYear) return dayjsInstance(date).format('DD MMMM YYYY');
    return dayjsInstance(date).format('dddd DD MMMM');
  };

  return (
    <>
      <InputContainer>
        {label && <Label bold label={label} />}
        <Inputs>
          <InputSubContainer onPress={onDateChooseRequest} testID={testID}>
            <Input asPlaceholder={!date?.length}>{renderDate()}</Input>
            {!required && Boolean(date?.length) && <ButtonReset onPress={onClearDate} />}
          </InputSubContainer>
          {renderTime()}
        </Inputs>
      </InputContainer>
      <DatePicker mode={mode} visible={visible} initDate={date?.length ? new Date(date) : new Date()} onClose={onClose} selectDate={setDateRequest} />
    </>
  );
};

/*
  onChange:
  - triggered everytime the datepicker changes date on iOS -> need state
  - triggered everytime the OK button is tapped on android -> no need state
*/

// https://github.com/react-native-community/react-native-datetimepicker/issues/114

const DatePicker = ({ selectDate, mode, visible, initDate, onClose }) => {
  if (!visible) {
    return null;
  }
  return (
    <DateTimePicker
      testID="dateTimePicker"
      value={initDate}
      mode={mode}
      display="spinner"
      is24Hour
      onChange={(_, selectedDate) => {
        if (!selectedDate) return onClose();
        selectDate(selectedDate);
      }}
    />
  );
};

const InputContainer = styled.View`
  margin-bottom: 30px;
`;

const Inputs = styled.View`
  flex-direction: row;
`;

const InputSubContainer = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  border-width: 1px;
  border-color: rgba(30, 36, 55, 0.1);
  border-radius: 12px;
  padding-horizontal: 12px;
  padding-vertical: 15px;
  flex-grow: 1;
`;

const WithTimeContainer = styled.TouchableOpacity`
  align-items: center;
  padding-horizontal: 15px;
  padding-vertical: 10px;
  flex-grow: 1;
`;
const WithTime = styled(MyText)`
  font-weight: bold;
  align-self: center;
  margin-horizontal: 15px;
`;

const Input = styled(MyText)``;

export default DateAndTimeInput;
