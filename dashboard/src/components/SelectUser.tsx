import { useRecoilValue } from "recoil";
import { usersState } from "../recoil/auth";
import SelectCustom from "./SelectCustom";

const SelectUser = ({ value, onChange, ...props }) => {
  const allUsers = useRecoilValue(usersState);

  return (
    <SelectCustom
      options={allUsers.filter((u) => u.name)}
      name="user"
      isClearable={false}
      onChange={(v) => onChange(v?._id)}
      value={allUsers.filter((i) => i._id === value)[0]}
      placeholder={" -- Choisir un utilisateur -- "}
      getOptionValue={(i) => i._id}
      getOptionLabel={(i) => i?.name}
      {...props}
    />
  );
};

export default SelectUser;
