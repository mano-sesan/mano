import { useState } from "react";
import { useRecoilState } from "recoil";
import ButtonCustom from "../../components/ButtonCustom";
import { userState } from "../../recoil/auth";
import API, { tryFetchExpectOk } from "../../services/api";
import OpenNewWindowIcon from "../../components/OpenNewWindowIcon";

const Charte = () => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useRecoilState(userState);

  const onSigninValidated = async () => {
    setLoading(true);
    const termsAccepted = Date.now();
    const [error] = await tryFetchExpectOk(async () => API.put({ path: "/user", body: { termsAccepted } }));
    if (error) return;
    setUser({ ...user, termsAccepted });
  };

  return (
    <div
      className="tw-flex tw-w-full tw-flex-col tw-items-center tw-overflow-y-auto tw-overflow-x-hidden tw-rounded-lg tw-bg-white tw-py-20 tw-text-black"
      id="cgus"
    >
      <h1 className="tw-mb-4 tw-mt-20 tw-text-center tw-text-3xl tw-font-semibold tw-text-main">Charte d'Utilisation de Mano</h1>
      <small className="tw-block tw-text-center tw-font-medium tw-italic">
        Veuillez lire et accepter la Charte d'Utilisation de Mano avant de continuer
      </small>
      <main className="[&_b]:tw-font-weight-normal tw-w-full tw-max-w-prose tw-px-5">
        <h2 className="tw-mt-4 tw-mb-2 tw-text-main">Présentation du dispositif et propriété des données</h2>
        <p>
          MANO est un outil de suivi médico-social destiné aux professionnels sociaux et médico-sociaux intervenant auprès de publics en situation de
          grande précarité. Il comprend une application accessible sur le terrain et une interface web. Les données des personnes accompagnées,
          enregistrées par une organisation, sont conservées sur des serveurs sécurisés, agréés pour les données de santé. Seule la structure ayant
          saisi ces données peut y accéder.
          <br />
          Ce document est une charte qui régit la création, le stockage et l'utilisation de ces données. Élaborée avec les utilisateurs, elle sera
          mise à jour en fonction de leurs retours. MANO est un outil gratuit.
        </p>
        <h2 className="tw-mt-4 tw-mb-2 tw-text-main">Objectifs et approche terrain</h2>
        <p>
          MANO a pour finalité d’outiller ses utilisateurs dans l’accompagnement de leurs publics et de faciliter l’activité quotidienne ainsi que le
          suivi des actions engagées avec les usagers.
        </p>
        <p>
          L’équipe MANO s’engage à concevoir tout développement en restant au plus proche de l’éthique professionnelle inhérente au travail social et
          médico-social des utilisateurs.
        </p>
        <p>
          L’équipe MANO s’engage à organiser un écosystème collaboratif : des réunions interservices utilisant l’outil sont organisées au minimum tous
          les trois mois. Ces rencontres sont l'occasion d’échanger sur les pratiques et expériences liées à MANO, et de remonter les besoins
          identifiés sur le terrain.
        </p>
        <p>
          L’équipe MANO s’engage à prendre en compte les retours du terrain et à inclure les professionnels dans le processus de développement de
          l'outil.
        </p>
        <h2 className="tw-mt-4 tw-mb-2 tw-text-main">Installation et prise en main</h2>
        <p>L’équipe MANO s’engage à :</p>
        <ol className="tw-list-inside tw-list-disc">
          <li>Présenter l'outil et former les équipes utilisatrices.</li>
          <li>Accompagner les équipes dans l'utilisation de MANO sur le terrain.</li>
          <li>Fournir une assistance téléphonique.</li>
        </ol>
        <h2 className="tw-mt-4 tw-mb-2 tw-text-main">Évolution de l'outil</h2>
        <p>
          MANO évolue en continu. Les modifications apportées se basent sur les retours des utilisateurs. Pour ce faire, les utilisateurs doivent
          remonter leurs besoins ou propositions d'évolution à la personne responsable de leur accompagnement à l’utilisation de MANO.
        </p>
        <p>Les équipes peuvent également regrouper leurs retours et les soumettre lors des réunions interservices.</p>
        <h2 className="tw-mt-4 tw-mb-2 tw-text-main">Aspects juridiques et protection des données</h2>
        <ol className="tw-list-inside tw-list-disc">
          <li>Les administrateurs des équipes ont la possibilité d'effacer l'ensemble de leurs données à tout moment.</li>
          <li>L'équipe MANO s'engage à chiffrer les données et leurs sauvegardes côté client.</li>
          <li>
            L'accès aux informations est limité : chaque structure accède uniquement à ses propres données, sans pouvoir consulter celles des autres
            structures.
          </li>
          <li>
            L'équipe MANO ne peut accéder aux données des équipes et des personnes suivies. Cependant, elle peut consulter les statistiques globales
            d'utilisation de l'outil, dépourvues d'informations personnelles.
          </li>
          <li>
            Les données sont stockées sur des serveurs agréés pour les données de santé, avec un niveau de sécurité optimal pour prévenir toute fuite
            de données préjudiciable aux personnes suivies ou aux utilisateurs.
          </li>
        </ol>
        <h2 className="tw-mt-4 tw-mb-2 tw-text-main">Engagement des utilisateurs</h2>
        <p>Tout utilisateur de MANO s'engage à protéger les données des personnes suivies&nbsp;:</p>
        <ol className="tw-list-inside tw-list-disc">
          <li>
            Toute personne suivie devra être informée et donner au minimum un accord oral pour figurer dans MANO, après une brève présentation de
            l'outil et de ses finalités. Toutefois, une dérogation est possible, notamment si la personne présente un danger pour autrui ou pour
            elle-même, nécessitant une prise en charge particulière par les équipes.
          </li>
          <li>
            Les utilisateurs s'engagent à ne saisir que les informations strictement nécessaires à l'accompagnement, en anonymisant autant que
            possible les dossiers. L'identité réelle peut toutefois être utilisée si elle est nécessaire à l'accompagnement.
          </li>
          <li>Les notions de secret professionnel et de secret professionnel partagé s'appliquent à l'utilisation de MANO.</li>
          <li>Les identifiants et mots de passe sont strictement personnels et ne doivent pas être partagés.</li>
          <li>
            Il est interdit de partager les données d'une personne suivie sans son consentement à des individus extérieurs à l'équipe ou sans lien
            avec son suivi médico-social.
          </li>
          <li>
            Les administrateurs doivent mettre à jour les accès à MANO. En cas de départ d'un membre de l'équipe, son compte doit être supprimé le
            jour même
          </li>
        </ol>
        <p>Lors de la création d'un nouveau compte&nbsp;:</p>
        <ol className="tw-list-inside tw-list-disc">
          <li>
            Les administrateurs doivent solliciter l'équipe MANO pour assurer une formation des nouveaux arrivants à l'outil. Cela permet d'éviter les
            mésusages et de promouvoir les bonnes pratiques numériques.
          </li>
        </ol>
        <p>L'accès au service se fait exclusivement dans un cadre professionnel&nbsp;:</p>
        <ol className="tw-list-inside tw-list-disc">
          <li>L'interface web doit être consultée sur un poste de travail professionnel.</li>
          <li>L'application doit être utilisée sur un téléphone professionnel.</li>
          <li>Les ordinateurs ou téléphones personnels ne doivent pas être utilisés pour accéder au service.</li>
        </ol>
        <p>
          Tout utilisateur s'engage à garantir la véracité des données renseignées. Les équipes doivent s'assurer d'utiliser des ordinateurs,
          smartphones ou tablettes protégés par des mots de passe et des antivirus pour éviter tout risque de violation des données.
        </p>
        <h2 className="tw-mt-4 tw-mb-2 tw-text-main">Falsification et duplication des données</h2>
        <ol className="tw-list-inside tw-list-disc">
          <li>La duplication des données pour un autre usage que celui prévu dans le cadre strict de la mission est interdite.</li>
          <li>
            Tout manquement à ces engagements peut conduire MANO à retirer l'utilisation de l'outil à un professionnel, une équipe ou une
            organisation.
          </li>
        </ol>
      </main>
      <ButtonCustom
        className="tw-m-auto tw-mt-20 tw-w-56 tw-rounded-3xl tw-text-base"
        loading={loading}
        type="submit"
        color="primary"
        title="Accepter et continuer"
        onClick={onSigninValidated}
      />
      <a className="tw-mb-20 tw-mt-3 tw-block tw-text-xs" href="/charte.pdf" target="_blank" rel="noreferrer">
        Télécharger le .pdf <OpenNewWindowIcon />
      </a>
    </div>
  );
};

export default Charte;
