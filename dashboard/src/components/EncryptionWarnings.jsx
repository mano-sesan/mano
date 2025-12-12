import { useAtomValue } from "jotai";
import { useHistory } from "react-router-dom";
import { organisationState, userState, encryptionKeyLengthState, MINIMUM_ENCRYPTION_KEY_LENGTH } from "../atoms/auth";
import { dayjsInstance, formatDateWithNameOfDay } from "../services/date";

const encryptionChangeOfKeyEnabled = true;
const MAY_24_2024 = "2024-05-24";

export default function EncryptionWarnings() {
  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState);
  const encryptionKeyLength = useAtomValue(encryptionKeyLengthState);
  const history = useHistory();

  // Only show for admin users
  if (!user || !["admin"].includes(user.role)) return null;
  if (!organisation) return null;

  const goToEncryptionTab = () => {
    history.push(`/organisation/${organisation._id}?tab=encryption`);
  };

  const showKeyTooShort = encryptionChangeOfKeyEnabled && organisation.encryptionEnabled && encryptionKeyLength < MINIMUM_ENCRYPTION_KEY_LENGTH;

  // Check if encryption key hasn't been updated since May 24, 2024
  let showKeyOutdated = false;
  let durationText = "";

  if (encryptionChangeOfKeyEnabled && organisation.encryptionLastUpdateAt) {
    const lastUpdateDate = dayjsInstance(organisation.encryptionLastUpdateAt);
    const cutoffDate = dayjsInstance(MAY_24_2024);

    if (lastUpdateDate.isValid() && lastUpdateDate.isBefore(cutoffDate)) {
      showKeyOutdated = true;
      durationText = formatDateWithNameOfDay(organisation.encryptionLastUpdateAt);
    }
  }

  if (!showKeyTooShort && !showKeyOutdated) return null;

  return (
    <>
      {showKeyTooShort && (
        <div className="tw-m-2 tw-rounded tw-border tw-border-orange-50 tw-bg-amber-100 tw-px-5 tw-py-3 tw-text-orange-900 print:tw-hidden">
          Votre clé de chiffrement est trop courte. Pour des raisons de sécurité, nous vous recommandons de la changer.{" "}
          <button type="button" onClick={goToEncryptionTab} className="tw-font-bold tw-underline">
            Cliquez ici
          </button>{" "}
          ou sur le menu «&nbsp;Organisation&nbsp;» puis «&nbsp;Chiffrement&nbsp;» pour la modifier.
        </div>
      )}
      {showKeyOutdated && (
        <div className="tw-m-2 tw-rounded tw-border tw-border-orange-50 tw-bg-amber-100 tw-px-5 tw-py-3 tw-text-orange-900 print:tw-hidden">
          Votre clé de chiffrement n'a pas été modifiée depuis le {durationText}. Pour des raisons de sécurité, nous vous recommandons de la mettre à
          jour.{" "}
          <button type="button" onClick={goToEncryptionTab} className="tw-font-bold tw-underline">
            Cliquez ici
          </button>{" "}
          ou sur le menu «&nbsp;Organisation&nbsp;» puis «&nbsp;Chiffrement&nbsp;» pour la modifier.
        </div>
      )}
    </>
  );
}
