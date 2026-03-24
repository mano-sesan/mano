import SelectCustom from "./SelectCustom";

const roles = [
  { value: "normal", label: "Normal" },
  { value: "admin", label: "Admin" },
  { value: "restricted-access", label: "Accès restreint" },
  { value: "stats-only", label: "Statistiques seulement" },
];

const SelectRole = ({ value, handleChange }) => (
  <SelectCustom
    options={roles}
    onChange={({ value }) => handleChange({ target: { value, name: "role" } })}
    value={roles.find((r) => r.value === value)}
    inputId="role"
    classNamePrefix="role"
  />
);

export default SelectRole;
