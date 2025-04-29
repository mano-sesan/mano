import { formatDateWithFullMonth } from "../services/date";
import { UserInstance } from "../types/user";

export default function UserStatus({ user }: { user: UserInstance }) {
  if (user.disabledAt) {
    return (
      <>
        <div className="tw-text-red-500 tw-font-bold">Désactivé</div>
        <div className="tw-text-xs tw-text-red-700">Désactivé le {formatDateWithFullMonth(user.disabledAt)} après 3 mois d'inactivité.</div>
      </>
    );
  }
  if (user.decryptAttempts > 12) {
    return (
      <>
        <div className="tw-text-red-500 tw-font-bold">Bloqué</div>
        <div className="tw-text-xs tw-text-red-700">Bloqué après 12 tentatives de déchiffrement.</div>
      </>
    );
  }
  if (user.loginAttempts > 12) {
    return (
      <>
        <div className="tw-text-red-500 tw-font-bold">Bloqué</div>
        <div className="tw-text-xs tw-text-red-700">Bloqué après 12 erreurs de mot de passe.</div>
      </>
    );
  }
  if (!user.lastLoginAt) return <div className="tw-text-orange-900">Pas encore actif</div>;

  return <div className="tw-text-main tw-font-bold">Actif</div>;
}
