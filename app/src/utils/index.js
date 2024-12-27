export const isEmptyValue = (value) => !value || (Array.isArray(value) && value.length === 0);
