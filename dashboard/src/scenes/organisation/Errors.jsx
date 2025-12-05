import API, { tryFetchExpectOk } from "../../services/api";
import { decrypt, derivedMasterKey, encryptItem, getHashedOrgEncryptionKey } from "../../services/encryption";
import { useAtomValue } from "jotai";
import structuredClone from "@ungap/structured-clone";
import { organisationState, userState } from "../../recoil/auth";
import { useEffect, useState } from "react";
import Loading from "../../components/loading";
import Table from "../../components/table";
import { toast } from "react-toastify";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import KeyInput from "../../components/KeyInput";
import { useDataLoader } from "../../services/dataLoader";
import DateBloc, { TimeBlock } from "../../components/DateBloc";
import { dayjsInstance } from "../../services/date";

const getErroredDecryption = async (item) => {
  try {
    await decrypt(item.encrypted, item.encryptedEntityKey, getHashedOrgEncryptionKey());
  } catch (_e) {
    return item;
  }
  return null;
};

async function fetchErrored(organisationId, path) {
  const query = {
    organisation: organisationId,
    limit: String(10000),
  };
  let page = 0;
  let finished = false;
  const erroredPersons = [];
  while (!finished) {
    const [error, res] = await tryFetchExpectOk(async () => {
      return API.get({ path, query: { ...query, page: String(page), withDeleted: true } });
    });
    if (error) {
      toast.error("Erreur lors de la récupération des données en erreur, pas de chance");
      return [];
    }
    if (!res.hasMore) finished = true;
    const decryptedData = (await Promise.all(res.data.map((p) => getErroredDecryption(p)))).filter((e) => e);
    erroredPersons.push(...decryptedData.map((p) => ({ _id: p._id, type: path, data: p })));
    page++;
  }
  return erroredPersons;
}

export default function Errors() {
  const user = useAtomValue(userState);
  const { refresh } = useDataLoader();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState(undefined);
  const [data, setData] = useState(undefined);
  const [loadingInfo, setLoadingInfo] = useState("");
  const organisation = useAtomValue(organisationState);

  async function fetchData() {
    let res = [];
    setLoadingInfo(`Chargement des personnes… (${res.length} erreurs trouvées)`);
    res.push(...(await fetchErrored(organisation._id, "person")));
    setLoadingInfo(`Chargement des groupes… (${res.length} erreurs trouvées)`);
    res.push(...(await fetchErrored(organisation._id, "group")));
    setLoadingInfo(`Chargement des rapports… (${res.length} erreurs trouvées)`);
    res.push(...(await fetchErrored(organisation._id, "report")));
    setLoadingInfo(`Chargement des passages… (${res.length} erreurs trouvées)`);
    res.push(...(await fetchErrored(organisation._id, "passage")));
    setLoadingInfo(`Chargement des rencontres… (${res.length} erreurs trouvées)`);
    res.push(...(await fetchErrored(organisation._id, "rencontre")));
    setLoadingInfo(`Chargement des actions… (${res.length} erreurs trouvées)`);
    res.push(...(await fetchErrored(organisation._id, "action")));
    setLoadingInfo(`Chargement des territoires… (${res.length} erreurs trouvées)`);
    res.push(...(await fetchErrored(organisation._id, "territory")));
    setLoadingInfo(`Chargement des lieux… (${res.length} erreurs trouvées)`);
    res.push(...(await fetchErrored(organisation._id, "place")));
    setLoadingInfo(`Chargement des relations personnes-lieux… (${res.length} erreurs trouvées)`);
    res.push(...(await fetchErrored(organisation._id, "relPersonPlace")));
    setLoadingInfo(`Chargement des observations de territoires… (${res.length} erreurs trouvées)`);
    res.push(...(await fetchErrored(organisation._id, "territory-observation")));
    setLoadingInfo(`Chargement des commentaires… (${res.length} erreurs trouvées)`);
    res.push(...(await fetchErrored(organisation._id, "comment")));
    setLoadingInfo(`Chargement des consultations… (${res.length} erreurs trouvées)`);
    if (user.healthcareProfessional) {
      res.push(...(await fetchErrored(organisation._id, "consultation")));
      setLoadingInfo(`Chargement des traitements… (${res.length} erreurs trouvées)`);
      res.push(...(await fetchErrored(organisation._id, "treatment")));
      setLoadingInfo(`Chargement des dossiers médicaux… (${res.length} erreurs trouvées)`);
      res.push(...(await fetchErrored(organisation._id, "medical-file")));
    }
    setLoadingInfo(`Enregistrement des données… (${res.length} erreurs trouvées)`);
    setData(res);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data)
    return (
      <>
        <Disclaimer />
        <Loading />
        <div className="tw-italic tw-text-xs tw-text-center tw-w-96 tw-mx-auto tw-mt-8 tw-animate-pulse">
          Le chargement des données en erreur nécessite de recharger puis déchiffrer toute la base de données, cela peut être long…
          <br />
          {loadingInfo}
        </div>
      </>
    );

  return (
    <div>
      <Disclaimer />
      <div className="tw-mt-8">
        <Table
          data={data}
          rowKey={"_id"}
          noData="Aucune donnée en erreur"
          columns={[
            { title: "_id", dataKey: "_id" },
            { title: "Type", dataKey: "type" },
            {
              title: "Créé le",
              dataKey: "createdAt",
              style: { width: "90px" },
              small: true,
              render: (item) => {
                return (
                  <>
                    <DateBloc date={item.data.createdAt} />
                    <TimeBlock time={item.data.createdAt} />
                  </>
                );
              },
            },
            {
              title: "Dernière mise-à-jour",
              dataKey: "updatedAt",
              style: { width: "90px" },
              small: true,
              render: (item) => {
                const latestDate = dayjsInstance(item.data.updatedAt).isAfter(dayjsInstance(item.data.deletedAt))
                  ? item.data.updatedAt
                  : item.data.deletedAt;
                return (
                  <>
                    <DateBloc date={latestDate} />
                    <TimeBlock time={latestDate} />
                  </>
                );
              },
            },
            {
              title: "Déchiffrer",
              dataKey: "action-dechiffrer",
              render: (row) => (
                <button
                  className="button-classic"
                  onClick={() => {
                    setItem(row);
                    setOpen(true);
                  }}
                >
                  Déchiffrer / Réparer
                </button>
              ),
            },
            {
              title: "Supprimer définitivement",
              dataKey: "action-supprimer",
              render: (item) => (
                <button
                  className="button-destructive"
                  onClick={async () => {
                    if (!confirm("Voulez-vous vraiment supprimer DEFINITIVEMENT cette donnée ?")) return;
                    function baseParams() {
                      return {
                        groups: [],
                        persons: [],
                        actions: [],
                        comments: [],
                        passages: [],
                        rencontres: [],
                        consultations: [],
                        treatments: [],
                        medicalFiles: [],
                        relsPersonPlaces: [],
                        reports: [],
                        territories: [],
                        places: [],
                        territoryObservations: [],
                      };
                    }
                    if (item.type === "person") {
                      if (!item.data.deletedAt) {
                        const [errorDeletePerson] = await tryFetchExpectOk(
                          async () =>
                            await API.delete({
                              path: `/person/${item.data._id}`,
                              body: {
                                actionsToTransfer: [],
                                commentsToTransfer: [],
                                actionIdsToDelete: [],
                                commentIdsToDelete: [],
                                passageIdsToDelete: [],
                                rencontreIdsToDelete: [],
                                consultationIdsToDelete: [],
                                treatmentIdsToDelete: [],
                                medicalFileIdsToDelete: [],
                                relsPersonPlaceIdsToDelete: [],
                              },
                            })
                        );
                        if (errorDeletePerson) {
                          return toast.error("Erreur lors de la suppression de la personne");
                        }
                      }

                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), persons: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive de la personne");
                      }
                    }
                    if (item.type === "group") {
                      if (!item.data.deletedAt) {
                        const [errorDeleteGroup] = await tryFetchExpectOk(async () => await API.delete({ path: `/group/${item.data._id}` }));
                        if (errorDeleteGroup) {
                          return toast.error("Erreur lors de la suppression du groupe");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), groups: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive du groupe");
                      }
                    }
                    if (item.type === "report") {
                      if (!item.data.deletedAt) {
                        const [errorDeleteReport] = await tryFetchExpectOk(async () => await API.delete({ path: `/report/${item.data._id}` }));
                        if (errorDeleteReport) {
                          return toast.error("Erreur lors de la suppression du rapport");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), reports: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive du rapport");
                      }
                    }
                    if (item.type === "passage") {
                      if (!item.data.deletedAt) {
                        const [errorDeletePassage] = await tryFetchExpectOk(async () => await API.delete({ path: `/passage/${item.data._id}` }));
                        if (errorDeletePassage) {
                          return toast.error("Erreur lors de la suppression du passage");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), passages: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive du passage");
                      }
                    }
                    if (item.type === "rencontre") {
                      if (!item.data.deletedAt) {
                        const [errorDeleteRencontre] = await tryFetchExpectOk(async () => await API.delete({ path: `/rencontre/${item.data._id}` }));
                        if (errorDeleteRencontre) {
                          return toast.error("Erreur lors de la suppression de la rencontre");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), rencontres: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive de la rencontre");
                      }
                    }
                    if (item.type === "action") {
                      if (!item.data.deletedAt) {
                        const [errorDeleteAction] = await tryFetchExpectOk(async () => await API.delete({ path: `/action/${item.data._id}` }));
                        if (errorDeleteAction) {
                          return toast.error("Erreur lors de la suppression de l'action");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), actions: [item.data._id] },
                        })
                      );
                      if (error) {
                        toast.error("Erreur lors de la suppression définitive de l'action");
                      }
                    }
                    if (item.type === "territory") {
                      if (!item.data.deletedAt) {
                        const [errorDeleteTerritory] = await tryFetchExpectOk(async () => await API.delete({ path: `/territory/${item.data._id}` }));
                        if (errorDeleteTerritory) {
                          return toast.error("Erreur lors de la suppression du territoire");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), territories: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive du territoire");
                      }
                    }
                    if (item.type === "place") {
                      if (!item.data.deletedAt) {
                        const [errorDeletePlace] = await tryFetchExpectOk(async () => await API.delete({ path: `/place/${item.data._id}` }));
                        if (errorDeletePlace) {
                          return toast.error("Erreur lors de la suppression du lieu");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), places: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive du lieu");
                      }
                    }
                    if (item.type === "territory-observation") {
                      if (!item.data.deletedAt) {
                        const [errorDeleteTerritoryObservation] = await tryFetchExpectOk(
                          async () => await API.delete({ path: `/territory-observation/${item.data._id}` })
                        );
                        if (errorDeleteTerritoryObservation) {
                          return toast.error("Erreur lors de la suppression de l'observation de territoire");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), territoryObservations: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive de l'observation de territoire");
                      }
                    }
                    if (item.type === "comment") {
                      if (!item.data.deletedAt) {
                        const [errorDeleteComment] = await tryFetchExpectOk(async () => await API.delete({ path: `/comment/${item.data._id}` }));
                        if (errorDeleteComment) {
                          return toast.error("Erreur lors de la suppression du commentaire");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), comments: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive du commentaire");
                      }
                    }
                    if (user.healthcareProfessional && item.type === "consultation") {
                      if (!item.data.deletedAt) {
                        const [errorDeleteConsultation] = await tryFetchExpectOk(
                          async () => await API.delete({ path: `/consultation/${item.data._id}` })
                        );
                        if (errorDeleteConsultation) {
                          return toast.error("Erreur lors de la suppression de la consultation");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), consultations: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive de la consultation");
                      }
                    }
                    if (user.healthcareProfessional && item.type === "treatment") {
                      if (!item.data.deletedAt) {
                        const [errorDeleteTreatment] = await tryFetchExpectOk(async () => await API.delete({ path: `/treatment/${item.data._id}` }));
                        if (errorDeleteTreatment) {
                          return toast.error("Erreur lors de la suppression du traitement");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), treatments: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive du traitement");
                      }
                    }
                    if (user.healthcareProfessional && item.type === "medical-file") {
                      if (!item.data.deletedAt) {
                        const [errorDeleteMedicalFile] = await tryFetchExpectOk(
                          async () => await API.delete({ path: `/medical-file/${item.data._id}` })
                        );
                        if (errorDeleteMedicalFile) {
                          return toast.error("Erreur lors de la suppression du dossier médical");
                        }
                      }
                      const [error] = await tryFetchExpectOk(async () =>
                        API.delete({
                          path: "/organisation/" + organisation._id + "/permanent-delete-data",
                          body: { ...baseParams(), medicalFiles: [item.data._id] },
                        })
                      );
                      if (error) {
                        return toast.error("Erreur lors de la suppression définitive du dossier médical");
                      }
                    }
                    fetchData();
                    await refresh();
                    toast.success("L'élément a été supprimé !");
                    await fetchData();
                  }}
                >
                  Suppr.&nbsp;définitivement
                </button>
              ),
            },
          ]}
        />
      </div>
      <ModalRepair open={open} setOpen={setOpen} setData={setData} item={item} />
    </div>
  );
}

function ModalRepair({ open, setOpen, setData, item }) {
  const user = useAtomValue(userState);
  const [key, setKey] = useState("");
  const { refresh } = useDataLoader();

  async function testAndFixKey() {
    const itemData = structuredClone(item.data);
    const derived = await derivedMasterKey(key);
    try {
      const { content } = await decrypt(item.data.encrypted, item.data.encryptedEntityKey, derived);
      itemData.decrypted = JSON.parse(content);
    } catch (_e) {
      toast.error("La clé de chiffrement ne fonctionne pas pour cet élément");
      return;
    }
    toast.success("La clé de chiffrement est valide");
    delete itemData.encrypted;
    delete itemData.encryptedEntityKey;
    delete itemData.entityKey;
    const encryptedItem = await encryptItem(itemData);

    if (item.type === "person") {
      await API.put({ path: `/person/${itemData._id}`, body: encryptedItem });
    }
    if (item.type === "group") {
      await API.put({ path: `/group/${itemData._id}`, body: encryptedItem });
    }
    if (item.type === "report") {
      await API.put({ path: `/report/${itemData._id}`, body: encryptedItem });
    }
    if (item.type === "passage") {
      await API.put({ path: `/passage/${itemData._id}`, body: encryptedItem });
    }
    if (item.type === "rencontre") {
      await API.put({ path: `/rencontre/${itemData._id}`, body: encryptedItem });
    }
    if (item.type === "action") {
      await API.put({ path: `/action/${itemData._id}`, body: encryptedItem });
    }
    if (item.type === "territory") {
      await API.put({ path: `/territory/${itemData._id}`, body: encryptedItem });
    }
    if (item.type === "place") {
      await API.put({ path: `/place/${itemData._id}`, body: encryptedItem });
    }
    if (item.type === "relPersonPlace") {
      await API.put({ path: `/relPersonPlace/${itemData._id}`, body: encryptedItem });
    }
    if (item.type === "territory-observation") {
      await API.put({ path: `/territory-observation/${itemData._id}`, body: encryptedItem });
    }
    if (item.type === "comment") {
      await API.put({ path: `/comment/${itemData._id}`, body: encryptedItem });
    }
    if (user.healthcareProfessional && item.type === "consultation") {
      await API.put({ path: `/consultation/${itemData._id}`, body: encryptedItem });
    }
    if (user.healthcareProfessional && item.type === "treatment") {
      await API.put({ path: `/treatment/${itemData._id}`, body: encryptedItem });
    }
    if (user.healthcareProfessional && item.type === "medical-file") {
      await API.put({ path: `/medical-file/${itemData._id}`, body: encryptedItem });
    }
    await refresh();
    toast.success("L'élément a été réparé !");
    setOpen(false);
    setData((d) => d.filter((i) => i._id !== item._id));
  }

  if (!item) return null;

  return (
    <ModalContainer open={open} onClose={() => setOpen(false)} size="xl">
      <ModalHeader title={"Réparer " + item._id} />
      <ModalBody>
        <div className="tw-p-4">
          <label htmlFor="test-key">Clé de chiffrement à essayer</label>
          <KeyInput
            id="test-key"
            onPressEnter={() => {
              testAndFixKey();
            }}
            onChange={(e) => {
              setKey(e);
            }}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <button className="button-classic" onClick={() => setOpen(false)}>
          Fermer
        </button>
        <button className="button-submit" onClick={() => testAndFixKey()}>
          Tester la clé
        </button>
      </ModalFooter>
    </ModalContainer>
  );
}

function Disclaimer() {
  return (
    <div className="tw-mb-8 tw-border-l-4 tw-border-orange-500 tw-bg-orange-100 tw-p-4 tw-text-orange-700" role="alert">
      Vous retrouvez ici les données corrompues ou non déchiffrables. Vous pouvez tenter de les restaurer en essayant une ancienne clé de chiffrement.
    </div>
  );
}
