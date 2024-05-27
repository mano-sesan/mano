const thousand = 1000;
const oneMillion = thousand * thousand;
const oneBillion = oneMillion * thousand;
const oneTrillion = oneBillion * thousand;

const convertSecondsToTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  if (Math.floor(seconds) < 1) {
    return "déchiffrée instantanément";
  } else if (seconds < 60) {
    return `${Math.floor(seconds)} second${seconds > 2 ? "s" : ""} à déchiffrer`;
  } else if (minutes < 60) {
    return `${Math.floor(minutes)} minute${minutes > 2 ? "s" : ""} à déchiffrer`;
  } else if (hours < 24) {
    return `${Math.floor(hours)} heure${hours > 2 ? "s" : ""} à déchiffrer`;
  } else if (days < 30) {
    return `${Math.floor(days)} jour${days > 2 ? "s" : ""} à déchiffrer`;
  } else if (months < 12) {
    return `${Math.floor(months)} mois à déchiffrer`;
  } else if (years < thousand) {
    return `${Math.floor(years)} année${years > 2 ? "s" : ""} à déchiffrer`;
  } else if (years < oneMillion) {
    return `${Math.floor(years / thousand)} milliers d'années à déchiffrer`;
  } else if (years < oneBillion) {
    return `${Math.floor(years / oneMillion)} millions d'années à déchiffrer`;
  } else if (years < oneTrillion) {
    return `${Math.floor(years / oneBillion)} milliards d'années à déchiffrer`;
  } else {
    return `${Math.floor(years / oneTrillion)} trilliards d'années à déchiffrer`;
  }
};

export const getPasswordStrengthInTime = (password) => {
  // https://security.stackexchange.com/a/257595/187929
  // One trillion passwords per second sounds like a good rule of thumb in November 2021
  // Moore's Law: it doubles every 18 months
  // here is Moore's Law calculation
  let today = new Date();
  const startDate = new Date(2021, 10, 1);
  let monthsSinceStartDate = (today.getFullYear() - startDate.getFullYear()) * 12 + today.getMonth() - startDate.getMonth();
  const passwordsPerSecond = oneTrillion * 2 ** (monthsSinceStartDate / 18);
  const timePerCheckingOnePassword = 1 / passwordsPerSecond;

  /*
    https://security.stackexchange.com/a/257535/187929
    "If you're using a password manager, that means that a 20 character truly random password using the 94 non-whitespace ASCII characters, and 22 characters if you're using the Base64 characters. If you're not using a password manager, you probably should be."

    => we'll take 26 as the worst case scenario
  */
  /*
      formula: https://www.omnicalculator.com/other/password-entropy
      E = log2(RL),

      where:

      R - Size of the pool of unique characters from which we build the password; and
      L - Password length, i.e., the number of characters in the password.
      Using the properties of logarithms, we can rewrite the above formula as:

      E = L * log2(R).

  */

  const entropy = (password.length * Math.log(26)) / Math.log(2); // bits
  /*
  When calculating crack time for entropy, assume an attacker will get the password in half of the number of tries needed, so an entropy of 80, which refers to 280 passwords, can be cracked in 280pw / 2e13pw/s / 2 / 86400s/d / 365.25d/y = 957.7 years with November 2021 upgrades to the same cluster size
  */

  const timePerHackingAllPossibilities = Math.pow(2, entropy) * timePerCheckingOnePassword; // s
  const timePerHackingPassword = timePerHackingAllPossibilities / 2; // s

  return `${password.length} caractères - ${convertSecondsToTime(timePerHackingPassword)}`;
};
