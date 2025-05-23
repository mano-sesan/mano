import { MouseEventHandler, useEffect, useRef, useState } from "react";
import { Formik } from "formik";
import { toast } from "react-toastify";
import { useRecoilState, useRecoilValue } from "recoil";

import ButtonCustom from "../../components/ButtonCustom";
import EncryptionKey from "../../components/EncryptionKey";
import {
  fieldsPersonsCustomizableOptionsSelector,
  personFieldsIncludingCustomFieldsSelector,
  personsState,
  usePreparePersonForEncryption,
} from "../../recoil/persons";
import TableCustomFields from "../../components/TableCustomFields";
import { organisationState, encryptionKeyLengthState, MINIMUM_ENCRYPTION_KEY_LENGTH } from "../../recoil/auth";
import API, { tryFetchExpectOk } from "../../services/api";
import ExportData from "../data-import-export/ExportData";
import ImportPersons from "../data-import-export/ImportPersons";
import ImportConfig from "../data-import-export/ImportConfig";
import DownloadPersonsImportExample from "../data-import-export/DownloadPersonsImportExample";
import useTitle from "../../services/useTitle";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";

import { useDataLoader } from "../../services/dataLoader";
import ActionCategoriesSettings from "./ActionCategoriesSettings";
import ServicesSettings from "./ServicesSettings";
import ObservationsSettings from "./ObservationsSettings";
import ConsultationsSettings from "./ConsultationsSettings";
import MedicalFileSettings from "./MedicalFileSettings";
import PersonCustomFieldsSettings from "./PersonCustomFieldsSettings";
import StructuresCategoriesSettings from "./StructuresCategoriesSettings";
import Poubelle from "./Poubelle";
import CollaborationsSettings from "./CollaborationsSettings";
import { customFieldsMedicalFileSelector } from "../../recoil/medicalFiles";
import { dayjsInstance, now } from "../../services/date";
import { encryptItem } from "../../services/encryption";
import { errorMessage } from "../../utils";
import ImportTerritories from "../data-import-export/ImportTerritories";
import { flattenedTerritoriesTypesSelector, territoriesFields } from "../../recoil/territory";
import DownloadTerritoriesImportExample from "../data-import-export/DownloadTerritoriesImportExample";
import TerritoriesTypesSettings from "./TerritoriesTypesSettings";
import { DefaultFoldersMedical, DefaultFoldersPersons } from "./DefaultFolders";
import Errors from "./Errors";
import { flattenedStructuresCategoriesSelector, structuresFields } from "../../recoil/structures";
import DownloadStructuresImportExample from "../data-import-export/DownloadStructuresImportExample";
import ImportStructures from "../data-import-export/ImportStructures";
import ExportFiles from "../data-import-export/ExportFiles";

const getSettingTitle = (tabId) => {
  if (tabId === "infos") return "Informations";
  if (tabId === "encryption") return "Chiffrement";
  if (tabId === "reception") return "Accueil de jour";
  if (tabId === "actions") return "Actions";
  if (tabId === "structures") return "Contacts";
  if (tabId === "territories") return "Territoires";
  if (tabId === "rencontres-passages") return "Passages/rencontres";
  if (tabId === "consultations") return "Consultations";
  if (tabId === "collaborations") return "Co-interventions";
  if (tabId === "persons") return "Personnes suivies";
  if (tabId === "medicalFile") return "Dossier Médical";
  if (tabId === "import") return "Import de personnes suivies";
  if (tabId === "import-configuration") return "Import de configuration";
  if (tabId === "import-territories") return "Import de territoires";
  if (tabId === "import-structures") return "Import de contacts";
  if (tabId === "export") return "Export des données";
  if (tabId === "poubelle") return "Données supprimées";
  if (tabId === "errors") return "Données en erreur";
  return "";
};

function TabTitle({ children }) {
  return <h3 className="tw-my-10 tw-flex tw-justify-between tw-text-xl tw-font-extrabold">{children}</h3>;
}

function MenuButton({ selected, text, onClick }: { selected: boolean; text: string; onClick: () => void }) {
  return (
    <button className={["tw-text-sm ", selected ? "tw-text-main tw-font-semibold" : "tw-text-zinc-800"].join(" ")} onClick={onClick}>
      {text}
    </button>
  );
}

const encryptionChangeOfKeyEnabled = true;

const View = () => {
  const [organisation, setOrganisation] = useRecoilState(organisationState);
  const personFieldsIncludingCustomFields = useRecoilValue(personFieldsIncludingCustomFieldsSelector);
  const customFieldsMedicalFile = useRecoilValue(customFieldsMedicalFileSelector);
  const fieldsPersonsCustomizableOptions = useRecoilValue(fieldsPersonsCustomizableOptionsSelector);
  const encryptionKeyLength = useRecoilValue(encryptionKeyLengthState);
  const territoriesTypes = useRecoilValue(flattenedTerritoriesTypesSelector);
  const structuresCategories = useRecoilValue(flattenedStructuresCategoriesSelector);

  const persons = useRecoilValue(personsState);
  const { preparePersonForEncryption } = usePreparePersonForEncryption();
  const [refreshErrorKey, setRefreshErrorKey] = useState(0);
  const { refresh } = useDataLoader();

  const [tab, setTab] = useState(() => {
    if (!organisation.encryptionEnabled) return "encryption";
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("tab")) return searchParams.get("tab");
    return "infos";
  });
  const scrollContainer = useRef(null);
  useTitle(`Organisation - ${getSettingTitle(tab)}`);

  useEffect(() => {
    scrollContainer.current.scrollTo({ top: 0 });
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const onEditPersonsCustomInputChoice =
    (customFieldsRow) =>
    async ({ oldChoice, newChoice, field, fields }) => {
      const updatedPersons = replaceOldChoiceByNewChoice(persons, oldChoice, newChoice, field);

      const [error, response] = await tryFetchExpectOk(async () =>
        API.post({
          path: "/custom-field",
          body: {
            customFields: {
              [customFieldsRow]: fields,
            },
            persons: await Promise.all(updatedPersons.map(preparePersonForEncryption).map(encryptItem)),
          },
        })
      );
      if (!error) {
        toast.success("Choix mis à jour !");
        setOrganisation(response.data);
      } else {
        setRefreshErrorKey((k) => k + 1); // to reset the table to its original values
      }
      refresh();
    };

  return (
    <div className="relative tw--m-12 tw--mt-4 tw-flex tw-h-[calc(100%+4rem)] tw-flex-col">
      {encryptionChangeOfKeyEnabled && organisation.encryptionEnabled && encryptionKeyLength < MINIMUM_ENCRYPTION_KEY_LENGTH && (
        <div className="tw-rounded tw-border tw-border-orange-50 tw-bg-amber-100 tw-px-5 tw-py-3 tw-text-orange-900">
          Votre clé de chiffrement est trop courte. Pour des raisons de sécurité, nous vous recommandons de la changer.
          <br />
          <button type="button" onClick={() => setTab("encryption")} className="tw-font-bold tw-text-stone-800 tw-underline">
            Cliquez ici
          </button>{" "}
          ou sur le bouton «&nbsp;Chiffrement&nbsp;» pour la modifier.
        </div>
      )}
      {encryptionChangeOfKeyEnabled && now().diff(dayjsInstance(organisation.encryptionLastUpdateAt), "year") > 1 && (
        <div className="tw-rounded tw-border tw-border-orange-50 tw-bg-amber-100 tw-px-5 tw-py-3 tw-text-orange-900">
          Votre clé de chiffrement n'a pas été modifiée depuis plus d'un an. Pour des raisons de sécurité, nous vous recommandons de la mettre à jour.
          <br />
          <button type="button" onClick={() => setTab("encryption")} className="tw-font-bold tw-text-stone-800 tw-underline">
            Cliquez ici
          </button>{" "}
          ou sur le bouton «&nbsp;Chiffrement&nbsp;» pour la modifier.
        </div>
      )}
      <div className="tw-flex tw-flex-1 tw-overflow-hidden">
        <div className="tw-flex tw-h-full tw-w-58 tw-shrink-0 tw-flex-col tw-items-start tw-bg-main tw-px-2 tw-pt-2 tw-overflow-auto">
          <div className="tw-text-white tw-font-bold tw-text-sm mt-4">Général</div>
          <div className="rounded tw-mx-auto tw-w-full tw-p-2 my-2 tw-flex tw-bg-main25 tw-flex-col tw-gap-2 tw-items-start tw">
            <MenuButton selected={tab === "infos"} text="Informations" onClick={() => setTab("infos")} />
            <MenuButton selected={tab === "encryption"} text="Chiffrement" onClick={() => setTab("encryption")} />
          </div>
          <div className="tw-text-white tw-font-bold  tw-text-sm mt-3">Paramétrage de l’activité</div>
          <div className="rounded tw-mx-auto tw-w-full tw-p-2 my-2 tw-flex tw-bg-main25 tw-flex-col tw-gap-2 tw-items-start tw">
            <MenuButton selected={tab === "reception"} text="Accueil de jour" onClick={() => setTab("reception")} />
            <MenuButton selected={tab === "actions"} text="Actions" onClick={() => setTab("actions")} />
            <MenuButton selected={tab === "structures"} text="Contacts" onClick={() => setTab("structures")} />
            <MenuButton selected={tab === "territories"} text="Territoires" onClick={() => setTab("territories")} />
            <MenuButton selected={tab === "rencontres-passages"} text="Passages/rencontres" onClick={() => setTab("rencontres-passages")} />
            <MenuButton selected={tab === "consultations"} text="Consultations" onClick={() => setTab("consultations")} />
            <MenuButton selected={tab === "collaborations"} text="Co-interventions" onClick={() => setTab("collaborations")} />
          </div>
          <div className="tw-text-white tw-font-bold tw-text-sm mt-3">Personnes suivies</div>
          <div className="rounded tw-mx-auto tw-w-full tw-p-2 my-2 tw-flex tw-bg-main25 tw-flex-col tw-gap-2 tw-items-start tw">
            <MenuButton selected={tab === "persons"} text="Personnes suivies" onClick={() => setTab("persons")} />
            <MenuButton selected={tab === "medicalFile"} text="Dossier Médical" onClick={() => setTab("medicalFile")} />
          </div>
          <div className="tw-text-white tw-font-bold tw-text-sm mt-3">Import et export</div>
          <div className="rounded tw-mx-auto tw-w-full tw-p-2 my-2 tw-flex tw-bg-main25 tw-flex-col tw-gap-2 tw-items-start tw">
            <MenuButton selected={tab === "import"} text="Import de personnes suivies" onClick={() => setTab("import")} />
            <MenuButton selected={tab === "import-configuration"} text="Import de configuration" onClick={() => setTab("import-configuration")} />
            <MenuButton selected={tab === "import-territories"} text="Import de territoires" onClick={() => setTab("import-territories")} />
            <MenuButton selected={tab === "import-structures"} text="Import de contacts" onClick={() => setTab("import-structures")} />
            <MenuButton selected={tab === "export"} text="Export des données" onClick={() => setTab("export")} />
          </div>
          <div className="tw-text-white tw-font-bold tw-text-sm mt-3">Maintenance</div>
          <div className="rounded tw-mx-auto tw-w-full tw-p-2 my-2 tw-flex tw-bg-main25 tw-flex-col tw-gap-2 tw-items-start tw">
            <MenuButton selected={tab === "poubelle"} text="Données supprimées" onClick={() => setTab("poubelle")} />
            <MenuButton selected={tab === "errors"} text="Données en erreur" onClick={() => setTab("errors")} />
          </div>
        </div>
        <div ref={scrollContainer} className="tw-basis-full tw-overflow-auto tw-px-6 tw-py-4">
          <Formik
            initialValues={{
              ...organisation,
              receptionEnabled: organisation.receptionEnabled || false,
              groupsEnabled: organisation.groupsEnabled || false,
              passagesEnabled: organisation.passagesEnabled || false,
              checkboxShowAllOrgaPersons: organisation.checkboxShowAllOrgaPersons || false,
              rencontresEnabled: organisation.rencontresEnabled || false,
            }}
            enableReinitialize
            onSubmit={async (body) => {
              const [error, response] = await tryFetchExpectOk(async () => await API.put({ path: `/organisation/${organisation._id}`, body }));
              if (!error) {
                toast.success("Mise à jour !");
                setOrganisation(response.data);
              } else {
                toast.error(errorMessage(error));
              }
            }}
          >
            {({ values, handleChange, handleSubmit, isSubmitting }) => {
              switch (tab) {
                default:
                case "infos":
                  return (
                    <>
                      <TabTitle>Informations générales</TabTitle>
                      <div className="tw-mb-4 tw-flex tw-gap-4 tw-flex-wrap tw-flex-row tw-basis-full">
                        <div className="tw-flex tw-flex-col tw-basis-full tw-mb-4 tw-p-4">
                          <label htmlFor="name">Nom</label>
                          <input className="tailwindui" autoComplete="off" name="name" id="name" value={values.name} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="tw-mb-10 tw-flex tw-justify-end tw-gap-4">
                        <DeleteButtonAndConfirmModal
                          title={`Voulez-vous vraiment supprimer l'organisation ${organisation.name}`}
                          textToConfirm={organisation.name}
                          onConfirm={async () => {
                            const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/organisation/${organisation._id}` }));
                            if (!error) {
                              toast.success("Organisation supprimée");
                              tryFetchExpectOk(() => API.post({ path: "/user/logout" })).then(() => {
                                window.localStorage.removeItem("previously-logged-in");
                                window.location.href = "/auth";
                              });
                            } else {
                              toast.error(errorMessage(error));
                            }
                          }}
                        >
                          <span className="tw-mb-7 tw-block tw-w-full tw-text-center">
                            Cette opération est irréversible
                            <br />
                            et entrainera la suppression définitive de toutes les données liées à l'organisation&nbsp;:
                            <br />
                            équipes, utilisateurs, personnes suivies, actions, territoires, commentaires et observations, comptes-rendus...
                          </span>
                        </DeleteButtonAndConfirmModal>
                        <ButtonCustom
                          title="Mettre à jour"
                          type="submit"
                          loading={isSubmitting}
                          onClick={handleSubmit as unknown as MouseEventHandler<HTMLButtonElement>}
                        />
                      </div>
                      <hr />
                      {/* <h4 className="tw-my-8">Activer la case à cocher "Afficher les personnes de toute l'organisation"</h4>
                      <div className="tw-mb-4">
                        <div className="tw-ml-5 tw-flex tw-w-4/5 tw-items-baseline">
                          <input
                            type="checkbox"
                            name="checkboxShowAllOrgaPersons"
                            className="tw-mr-2"
                            id="checkboxShowAllOrgaPersons"
                            checked={values.checkboxShowAllOrgaPersons || false}
                            onChange={handleChange}
                          />
                          <label htmlFor="checkboxShowAllOrgaPersons">
                            Cette case à cocher, visible dans l'onglet "Personnes suivies", permet à un utilisateur d'avoir accès à toutes les
                            personnes de l'organisation MÊME SI des personnes suivies ne sont pas assignées à son équipe. Si cette option est
                            désactivée, un utilisateur ne pourra pas voir cette case à cocher lui permettant d'accéder aux dossiers des personnes
                            suivies qui ne sont pas assignées à son équipe.
                          </label>
                        </div>
                      </div>
                      <div className="tw-mb-10 tw-flex tw-justify-end tw-gap-4">
                        <ButtonCustom
                          title={"Mettre à jour"}
                          type="submit"
                          disabled={values.checkboxShowAllOrgaPersons === organisation.checkboxShowAllOrgaPersons}
                          loading={isSubmitting}
                          onClick={handleSubmit as unknown as MouseEventHandler<HTMLButtonElement>}
                        />
                      </div> */}
                    </>
                  );
                case "encryption":
                  return (
                    <>
                      <TabTitle>Chiffrement</TabTitle>
                      <div className="tw-mb-10 tw-flex tw-justify-around">
                        {encryptionChangeOfKeyEnabled || !organisation.encryptionEnabled ? (
                          <EncryptionKey isMain />
                        ) : (
                          <p>
                            Désolé, le changement de clé de chiffrement n'est pas disponible pour le moment. Il le sera d'ici la fin de la semaine.
                          </p>
                        )}
                      </div>
                    </>
                  );
                case "consultations":
                  return <ConsultationsSettings />;
                case "collaborations":
                  return <CollaborationsSettings />;
                case "medicalFile":
                  return (
                    <div>
                      <MedicalFileSettings />
                      <hr />
                      <h4 className="tw-my-8">Dossiers par défaut</h4>
                      <DefaultFoldersMedical />
                    </div>
                  );
                case "actions":
                  return <ActionCategoriesSettings />;
                case "structures":
                  return <StructuresCategoriesSettings />;
                case "reception":
                  return (
                    <>
                      <TabTitle>Accueil de jour</TabTitle>
                      <div className="tw-flex tw-flex-col">
                        <h4 className="tw-my-8">Activer l'accueil de jour</h4>
                        <div className="tw-mb-4">
                          <div className="tw-ml-5 tw-flex tw-w-4/5 tw-items-baseline">
                            <input
                              type="checkbox"
                              className="tw-mr-2"
                              name="receptionEnabled"
                              id="receptionEnabled"
                              checked={values.receptionEnabled || false}
                              onChange={handleChange}
                            />
                            <label htmlFor="receptionEnabled">
                              Activer l'accueil de jour, pour pouvoir enregistrer les services proposés par votre organisation. Un menu "Accueil"
                              apparaîtra sur la barre de navigation latérale.
                            </label>
                          </div>
                        </div>
                        <div className="tw-mb-10 tw-flex tw-justify-end tw-gap-4">
                          <ButtonCustom
                            title={"Mettre à jour"}
                            type="submit"
                            disabled={values.receptionEnabled === organisation.receptionEnabled}
                            loading={isSubmitting}
                            onClick={handleSubmit as unknown as MouseEventHandler<HTMLButtonElement>}
                          />
                        </div>
                        <hr />
                        <ServicesSettings key="reception" />
                      </div>
                    </>
                  );
                case "territories":
                  return (
                    <>
                      <TabTitle>Territoires</TabTitle>
                      <h4 className="tw-my-8">Activer les territoires</h4>
                      <div className="tw-mb-4">
                        <div className="tw-ml-5 tw-flex tw-w-4/5 tw-items-baseline">
                          <input
                            type="checkbox"
                            className="tw-mr-2"
                            name="territoriesEnabled"
                            id="territoriesEnabled"
                            checked={values.territoriesEnabled || false}
                            onChange={handleChange}
                          />
                          <label htmlFor="territoriesEnabled">
                            Activer les territoires, pour pouvoir enregistrer des observations liées à ces territoires. Un menu "Territoires"
                            apparaîtra sur la barre de navigation latérale, et sur l'application mobile.
                          </label>
                        </div>
                      </div>
                      <div className="tw-mb-10 tw-flex tw-justify-end tw-gap-4">
                        <ButtonCustom
                          title={"Mettre à jour"}
                          type="button"
                          disabled={values.territoriesEnabled === organisation.territoriesEnabled}
                          loading={isSubmitting}
                          onClick={handleSubmit as unknown as MouseEventHandler<HTMLButtonElement>}
                        />
                      </div>
                      <hr />
                      <TerritoriesTypesSettings />
                      <hr />
                      <ObservationsSettings />
                    </>
                  );
                case "rencontres-passages":
                  return (
                    <>
                      <TabTitle>Passages / rencontres</TabTitle>
                      <h4 className="tw-my-8">Activer les passages</h4>
                      <div className="tw-mb-4">
                        <div className="tw-ml-5 tw-flex tw-w-4/5 tw-items-baseline">
                          <input
                            type="checkbox"
                            className="tw-mr-2"
                            name="passagesEnabled"
                            id="passagesEnabled"
                            checked={values.passagesEnabled || false}
                            onChange={handleChange}
                          />
                          <label htmlFor="passagesEnabled">
                            Activer les passages vous permettra de comptabiliser les personnes qui passent sur votre structure.
                          </label>
                        </div>
                      </div>
                      <h4 className="tw-my-8">Activer les rencontres</h4>
                      <div className="tw-mb-4">
                        <div className="tw-ml-5 tw-flex tw-w-4/5 tw-items-baseline">
                          <input
                            type="checkbox"
                            className="tw-mr-2"
                            name="rencontresEnabled"
                            id="rencontresEnabled"
                            checked={values.rencontresEnabled || false}
                            onChange={handleChange}
                          />
                          <label htmlFor="rencontresEnabled">
                            Activer les rencontres vous permettra de comptabiliser les personnes rencontrées en rue.
                          </label>
                        </div>
                      </div>
                      <div className="tw-mb-10 tw-flex tw-justify-end tw-gap-4">
                        <ButtonCustom
                          title={"Mettre à jour"}
                          type="button"
                          disabled={
                            values.rencontresEnabled === organisation.rencontresEnabled && values.passagesEnabled === organisation.passagesEnabled
                          }
                          loading={isSubmitting}
                          onClick={handleSubmit as unknown as MouseEventHandler<HTMLButtonElement>}
                        />
                      </div>
                      <hr />
                    </>
                  );
                case "persons":
                  return (
                    <>
                      <TabTitle>Personnes suivies</TabTitle>
                      {organisation.encryptionEnabled ? (
                        <>
                          <h4 className="tw-my-8">Activer la fonctionnalité Liens familiaux</h4>
                          <div className="tw-mb-4">
                            <div className="tw-ml-5 tw-flex tw-w-4/5 tw-items-baseline">
                              <input
                                type="checkbox"
                                name="groupsEnabled"
                                className="tw-mr-2"
                                id="groupsEnabled"
                                checked={values.groupsEnabled || false}
                                onChange={handleChange}
                              />
                              <label htmlFor="groupsEnabled">
                                Activer la possibilité d'ajouter des liens familiaux entre personnes. Un onglet "Famille" sera rajouté dans les
                                personnes, et vous pourrez créer des actions, des commentaires et des documents visibles pour toute la famille.
                              </label>
                            </div>
                          </div>
                          <div className="tw-mb-10 tw-flex tw-justify-end tw-gap-4">
                            <ButtonCustom
                              title={"Mettre à jour"}
                              type="button"
                              disabled={values.groupsEnabled === organisation.groupsEnabled}
                              loading={isSubmitting}
                              onClick={handleSubmit as unknown as MouseEventHandler<HTMLButtonElement>}
                            />
                          </div>
                          <hr />
                          <h4 className="tw-my-8">Champs permanents - options modulables</h4>
                          <TableCustomFields
                            customFields="fieldsPersonsCustomizableOptions"
                            key={refreshErrorKey + "fieldsPersonsCustomizableOptions"}
                            data={persons}
                            fields={fieldsPersonsCustomizableOptions}
                            onlyOptionsEditable
                            onEditChoice={onEditPersonsCustomInputChoice("fieldsPersonsCustomizableOptions")}
                          />
                          <hr />
                          <PersonCustomFieldsSettings />
                          <hr />
                          <h4 className="tw-my-8">Dossiers par défaut</h4>
                          <DefaultFoldersPersons />
                        </>
                      ) : (
                        <>
                          <div className="tw-flex tw-flex-wrap -tw-mx-4">
                            <div className="tw-basis-10/12 tw-w-full tw-px-4">
                              <p>
                                Désolé, cette fonctionnalité qui consiste à personnaliser les champs disponibles pour les personnes suivies n'existe
                                que pour les organisations chiffrées.
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  );
                case "export":
                  return (
                    <>
                      <TabTitle>Exporter des données et les fichiers</TabTitle>
                      <div className="tw-mb-8">
                        Vous pouvez exporter l'ensemble de vos données brutes dans un fichier Excel et exporter les fichiers liés à vos personnes
                        suivies. Le temps de génération peut prendre plusieurs minutes.
                      </div>
                      <ExportData />
                      <ExportFiles />
                    </>
                  );
                case "import-configuration":
                  return (
                    <>
                      <TabTitle>Importer une configuration</TabTitle>
                      <div>
                        <ImportConfig scrollContainer={scrollContainer} />
                      </div>
                    </>
                  );
                case "poubelle":
                  return (
                    <>
                      <TabTitle>Personnes supprimées</TabTitle>
                      <div>
                        <Poubelle />
                      </div>
                    </>
                  );
                case "errors":
                  return (
                    <>
                      <TabTitle>Données en erreur</TabTitle>
                      <div>
                        <Errors />
                      </div>
                    </>
                  );
                case "import":
                  return (
                    <>
                      <TabTitle>Importer des personnes suivies</TabTitle>
                      <div className="tw-flex tw-flex-wrap -tw-mx-4">
                        <div className="tw-basis-10/12 tw-w-full tw-px-4">
                          <p>
                            Vous pouvez importer une liste de personnes suivies depuis un fichier Excel. Ce fichier doit avoir quelques
                            caractéristiques:
                          </p>
                          <ul className="tw-mt-4 tw-list-inside tw-list-disc">
                            <li>
                              avoir un onglet dont le nom contient <code>personne</code>
                            </li>
                            <li>avoir en première ligne de cet onglet des têtes de colonnes</li>
                            <li>
                              les colonnes qui seront importées peuvent être parmi la liste suivante - toute colonne qui ne s'appelle pas ainsi ne
                              sera pas prise en compte - certaines colonnes ont des valeurs imposées :
                              <table className="table-sm table tw-text-sm tw-mt-8">
                                <thead>
                                  <tr>
                                    <th>Colonne</th>
                                    <th>Valeur</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {personFieldsIncludingCustomFields
                                    .filter((f) => f.importable)
                                    .map((f, i) => {
                                      return (
                                        <tr key={f.label + i}>
                                          <td>{f.label}</td>
                                          <td>
                                            <ImportFieldDetails field={f} />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  {customFieldsMedicalFile.map((f, i) => {
                                    return (
                                      <tr key={f.label + i}>
                                        <td>{f.label}</td>
                                        <td>
                                          <ImportFieldDetails field={f} />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div className="tw-mb-10 tw-flex tw-justify-end tw-gap-4">
                        <DownloadPersonsImportExample />
                        <ImportPersons />
                      </div>
                    </>
                  );
                case "import-territories":
                  return (
                    <>
                      <TabTitle>Importer des territoires</TabTitle>
                      <div className="tw-flex tw-flex-wrap -tw-mx-4">
                        <div className="tw-basis-10/12 tw-w-full tw-px-4">
                          <p>
                            Vous pouvez importer une liste de territoires depuis un fichier Excel. Ce fichier doit avoir quelques caractéristiques:
                          </p>
                          <ul className="tw-mt-4 tw-list-inside tw-list-disc">
                            <li>
                              avoir un onglet dont le nom contient <code>territoire</code>
                            </li>
                            <li>avoir en première ligne de cet onglet des têtes de colonnes</li>
                            <li>
                              les colonnes qui seront importées peuvent être parmi la liste suivante - toute colonne qui ne s'appelle pas ainsi ne
                              sera pas prise en compte - certaines colonnes ont des valeurs imposées :
                              <table className="table-sm table tw-text-sm tw-mt-8">
                                <thead>
                                  <tr>
                                    <th>Colonne</th>
                                    <th>Valeur</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {territoriesFields(territoriesTypes)
                                    .filter((f) => f.importable)
                                    .map((f, i) => {
                                      return (
                                        <tr key={f.label + i}>
                                          <td>{f.label}</td>
                                          <td>
                                            <ImportFieldDetails field={f} />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div className="tw-mb-10 tw-flex tw-justify-end tw-gap-4">
                        <DownloadTerritoriesImportExample />
                        <ImportTerritories />
                      </div>
                    </>
                  );

                case "import-structures":
                  return (
                    <>
                      <TabTitle>Importer des Contacts</TabTitle>
                      <div className="tw-flex tw-flex-wrap -tw-mx-4">
                        <div className="tw-basis-10/12 tw-w-full tw-px-4">
                          <p>Vous pouvez importer une liste de contacts depuis un fichier Excel. Ce fichier doit avoir quelques caractéristiques:</p>
                          <ul className="tw-mt-4 tw-list-inside tw-list-disc">
                            <li>
                              avoir un onglet dont le nom contient <code>contact</code>
                            </li>
                            <li>avoir en première ligne de cet onglet des têtes de colonnes</li>
                            <li>
                              les colonnes qui seront importées peuvent être parmi la liste suivante - toute colonne qui ne s'appelle pas ainsi ne
                              sera pas prise en compte - certaines colonnes ont des valeurs imposées :
                              <table className="table-sm table tw-text-sm tw-mt-8">
                                <thead>
                                  <tr>
                                    <th>Colonne</th>
                                    <th>Valeur</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {structuresFields(structuresCategories)
                                    .filter((f) => f.importable)
                                    .map((f, i) => {
                                      return (
                                        <tr key={f.label + i}>
                                          <td>{f.label}</td>
                                          <td>
                                            <ImportFieldDetails field={f} />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div className="tw-mb-10 tw-flex tw-justify-end tw-gap-4">
                        <DownloadStructuresImportExample />
                        <ImportStructures />
                      </div>
                    </>
                  );
              }
            }}
          </Formik>
        </div>
      </div>
    </div>
  );
};

const ImportFieldDetails = ({ field }) => {
  if (field.options?.length) {
    return field.options?.map((option, index) => (
      <span key={option}>
        <code>
          {option}
          {index !== field.options.length - 1 && ", "}
        </code>
      </span>
    ));
  }
  if (["date", "date-with-time", "duration"].includes(field.type)) {
    return (
      <i style={{ color: "#666" }}>
        Une date sous la forme AAAA-MM-JJ (exemple: <code>2021-01-01</code>)
      </i>
    );
  }
  if (["boolean", "yes-no"].includes(field.type)) {
    return <code>Oui, Non</code>;
  }
  return <i style={{ color: "#666" }}>Un texte</i>;
};

const replaceOldChoiceByNewChoice = (data, oldChoice, newChoice, field) => {
  return data
    .map((item) => {
      if (typeof item[field.name] === "string") {
        if (item[field.name] !== oldChoice) return null;
        return {
          ...item,
          [field.name]: newChoice,
        };
      }
      // if not string, then it's array
      if (!Array.isArray(item[field.name])) return null;
      if (!item[field.name]?.includes(oldChoice)) return null;
      return {
        ...item,
        [field.name]: item[field.name].map((_choice) => (_choice === oldChoice ? newChoice : _choice)),
      };
    })
    .filter(Boolean);
};

export default View;
