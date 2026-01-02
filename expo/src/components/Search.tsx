import React, { useRef, useState } from "react";
import { Alert, Keyboard, TouchableOpacity, Animated, ViewStyle, TextStyle } from "react-native";
import API from "../services/api";
import ButtonReset from "./ButtonReset";
import { Search as SearchIcon } from "../icons";
import { MyTextInput } from "./MyText";
import { useAtomValue } from "jotai";
import { organisationState } from "../recoil/auth";

type SearchPropsBase = {
  placeholder?: string;
  style?: ViewStyle;
  onFocus?: () => void;
  parentScroll?: Animated.Value | undefined;
};

type SearchPropsWithOnChange = SearchPropsBase & {
  onChange: (search: string) => void;
  path?: never;
  onSearchStart?: never;
  onSearchClear?: never;
  withOrg?: never;
  onSearchComplete?: never;
};

type SearchPropsWithAPI = SearchPropsBase & {
  onChange?: never;
  path: string;
  onSearchStart?: (search: string) => void;
  onSearchClear?: () => void;
  withOrg?: boolean;
  onSearchComplete?: (data: any[]) => void;
};

type SearchProps = SearchPropsWithOnChange | SearchPropsWithAPI;

const Search = ({
  path,
  onSearchStart,
  onSearchClear,
  onChange,
  withOrg,
  onSearchComplete,
  placeholder,
  style = {},
  onFocus = () => null,
  parentScroll,
}: SearchProps) => {
  const [search, setSearch] = useState("");
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const keyboardDimissTimeout = useRef<NodeJS.Timeout | null>(null);

  const organisation = useAtomValue(organisationState)!;

  const onSearch = async (search: string) => {
    if (onChange) {
      setSearch(search);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        onChange(search);
      }, 300);
      return;
    }
    if (!onSearchStart) return;
    if (!onSearchComplete) return;
    onSearchStart(search);
    setSearch(search);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (keyboardDimissTimeout.current) clearTimeout(keyboardDimissTimeout.current);
    if (!search.length && onSearchClear) {
      onSearchClear();
      keyboardDimissTimeout.current = setTimeout(() => {
        Keyboard.dismiss();
      }, 1500);
    }
    const query: Record<string, string> = { search };
    if (withOrg) query.organisation = organisation._id;
    searchTimeout.current = setTimeout(async () => {
      const response = await API.execute({ path, query });
      if (response.error) {
        Alert.alert(response.error);
        onSearchComplete([]);
      }
      if (response.ok) {
        onSearchComplete(response.data);
      }
    }, 300);
  };
  return (
    <Animated.View style={[styles.inputContainer(parentScroll), style]}>
      <TouchableOpacity style={styles.inputSubContainer}>
        <SearchIcon size={16} color="#888" />
        <MyTextInput onFocus={onFocus} placeholder={placeholder} onChangeText={onSearch} value={search} style={styles.input} />
        {Boolean(search.length) && <ButtonReset onPress={() => onSearch("")} />}
      </TouchableOpacity>
    </Animated.View>
  );
};

type Styles = {
  inputContainer: (parentScroll: Animated.Value | undefined) => ViewStyle;
  inputSubContainer: ViewStyle;
  input: TextStyle;
};

const styles: Styles = {
  inputContainer: (parentScroll) => ({
    paddingVertical: 5,
    paddingHorizontal: 15,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1000,
    transform: [
      {
        translateY: parentScroll?.interpolate
          ? parentScroll.interpolate({
              inputRange: [0, 100],
              outputRange: [90, 0],
              extrapolate: "clamp",
            })
          : 0,
      },
    ],
  }),
  inputSubContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 15,
    flexGrow: 1,
    backgroundColor: "white",
    borderRadius: 100,
    borderColor: "#888",
    borderWidth: 1,
  },
  input: {
    flexGrow: 1,
    flexShrink: 0,
    backgroundColor: "transparent",
    padding: 0,
    paddingLeft: 15,
    fontSize: 16,
    lineHeight: 16,
  },
};

export default Search;
