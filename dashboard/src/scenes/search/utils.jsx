const excludeFields = new Set([
  "_id",
  "encryptedEntityKey",
  "entityKey",
  "createdBy",
  "documents",
  "user", // because it is an id
  "organisation", // because it is an id
  "action", // because it is an id
  "person", // because it is an id
  "team", // because it is an id
  "item", // because it is an id
  "history", // because it makes no sense
]);
const isObject = (variable) => typeof variable === "object" && variable !== null && !Array.isArray(variable);

// Une recherche est considérée comme un numéro de téléphone si elle ne contient
// que des chiffres et des séparateurs courants (+, -, ., /, (), espaces) et qu'elle
// comporte au moins 6 chiffres — au-dessus du seuil des codes postaux (5 chiffres).
const PHONE_LIKE_REGEX = /^[\s+\-./()\d]+$/;
const looksLikePhoneNumber = (search) => {
  if (!PHONE_LIKE_REGEX.test(search)) return false;
  return search.replace(/\D/g, "").length >= 6;
};
// Numéros français uniquement : on convertit le préfixe international 0033/+33 en 0.
const normalizePhoneSearch = (search) => {
  let digits = search.replace(/\D/g, "");
  if (digits.startsWith("0033")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("33") && digits.length === 11) digits = "0" + digits.slice(2);
  return digits;
};

const prepareItemForSearch = (item, userSpecificExcludeFields, restrictedFields = null) => {
  if (typeof item === "string") return item;
  if (!item) return "";
  const itemClean = {};
  for (let key of Object.keys(item)) {
    if (excludeFields.has(key)) continue;
    if (userSpecificExcludeFields.has(key)) continue;
    if (restrictedFields && !restrictedFields.includes(key)) continue;
    if (isObject(item[key])) {
      itemClean[key] = prepareItemForSearch(item[key], userSpecificExcludeFields, restrictedFields);
    } else if (Array.isArray(item[key])) {
      itemClean[key] = item[key].map((subItem) => prepareItemForSearch(subItem, userSpecificExcludeFields, restrictedFields));
    } else {
      itemClean[key] = item[key];
    }
  }
  return itemClean;
};

export const filterBySearch = (search, items = [], userSpecificExcludeFields = [], restrictedFields = null) => {
  const isPhoneSearch = looksLikePhoneNumber(search);
  const searchLowercased = search.toLocaleLowerCase();
  // replace all accents with normal letters
  const searchNormalized = searchLowercased.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const searchTerms = isPhoneSearch ? [normalizePhoneSearch(search)] : searchLowercased.split(" ");
  const searchNormalizedTerms = isPhoneSearch ? searchTerms : searchNormalized.split(" ");

  const itemsNameStartWithWord = [];
  const itemsNameStartWithWordWithNoAccent = [];
  const itemsNameContainsOneOfTheWords = [];
  const itemsNameContainsOneOfTheWordsWithNoAccent = [];
  const anyOtherPrropertyContainsOneOfTheWords = [];
  const anyOtherPrropertyContainsOneOfTheWordsWithNoAccent = [];

  for (const item of items) {
    const lowerCaseName = String(item?.name || "").toLocaleLowerCase();
    if (lowerCaseName.startsWith(searchLowercased)) {
      itemsNameStartWithWord.push(item);
      continue;
    }
    const normalizedName = lowerCaseName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalizedName.startsWith(searchNormalized)) {
      itemsNameStartWithWordWithNoAccent.push(item);
      continue;
    }

    if (searchTerms.every((word) => lowerCaseName.includes(word))) {
      itemsNameContainsOneOfTheWords.push(item);
      continue;
    }
    if (searchNormalizedTerms.every((word) => normalizedName.includes(word))) {
      itemsNameContainsOneOfTheWordsWithNoAccent.push(item);
      continue;
    }
    const stringifiedItem = JSON.stringify(prepareItemForSearch(item, new Set(userSpecificExcludeFields), restrictedFields)).toLocaleLowerCase();
    if (searchTerms.filter((word) => stringifiedItem.includes(word)).length === searchTerms.length) {
      anyOtherPrropertyContainsOneOfTheWords.push(item);
      continue;
    }
    const stringifiedItemWithNoAccent = stringifiedItem.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (searchNormalizedTerms.filter((word) => stringifiedItemWithNoAccent.includes(word)).length === searchNormalizedTerms.length) {
      anyOtherPrropertyContainsOneOfTheWordsWithNoAccent.push(item);
      continue;
    }
  }

  return [
    ...itemsNameStartWithWord,
    ...itemsNameStartWithWordWithNoAccent,
    ...itemsNameContainsOneOfTheWords,
    ...itemsNameContainsOneOfTheWordsWithNoAccent,
    ...anyOtherPrropertyContainsOneOfTheWords,
    ...anyOtherPrropertyContainsOneOfTheWordsWithNoAccent,
  ];
};
