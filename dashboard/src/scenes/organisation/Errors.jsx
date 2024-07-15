import API, { tryFetchExpectOk } from "../../services/api";
import { decrypt, derivedMasterKey, encryptItem, getHashedOrgEncryptionKey } from "../../services/encryption";
import { useRecoilValue } from "recoil";
import { organisationState } from "../../recoil/auth";
import { useEffect, useState } from "react";
import Loading from "../../components/loading";
import Table from "../../components/table";
import { toast } from "react-toastify";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import KeyInput from "../../components/KeyInput";
import { useDataLoader } from "../../components/DataLoader";

const getErroredDecryption = async (item) => {
  try {
    await decrypt(item.encrypted, item.encryptedEntityKey, getHashedOrgEncryptionKey());
  } catch (_e) {
    return item;
  }
  return null;
};

async function fetchErroredPersons(organisationId) {
  const query = {
    organisation: organisationId,
    limit: String(10000),
    withDeleted: true,
  };
  let page = 0;
  let finished = false;
  const erroredPersons = [];
  while (!finished) {
    const [error, res] = await tryFetchExpectOk(async () => {
      return API.get({ path: "/person", query: { ...query, page: String(page) } });
    });
    if (error) {
      toast.error("Erreur lors de la récupération des personnes en erreur, vraiment pas de chance");
      return [];
    }
    if (!res.hasMore) finished = true;
    const decryptedData = (await Promise.all(res.data.map((p) => getErroredDecryption(p)))).filter((e) => e);
    erroredPersons.push(...decryptedData.map((p) => ({ _id: p._id, type: "person", data: p })));
  }
  return erroredPersons;
}

export default function Errors() {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState(undefined);
  const [data, setData] = useState(undefined);
  const organisation = useRecoilValue(organisationState);

  useEffect(() => {
    fetchErroredPersons(organisation._id).then((data) => {
      setData(data);
    });
  }, [organisation._id]);

  if (!data)
    return (
      <>
        <Disclaimer />
        <Loading />
        <div className="tw-italic tw-text-xs tw-text-center tw-w-96 tw-mx-auto tw-mt-8 tw-animate-pulse">
          Le chargement des données en erreur nécessite de recharger puis déchiffrer toute la base de données, cela peut être long…
        </div>
      </>
    );

  console.log(data);

  return (
    <div>
      <Disclaimer />
      <div className="mt-8">
        <Table
          data={data}
          rowKey={"_id"}
          noData="Aucune donnée en erreur"
          onRowClick={(row) => console.log(row)}
          columns={[
            { title: "_id", dataKey: "_id" },
            { title: "Type", dataKey: "type" },
            {
              title: "Déchiffrer",
              dataKey: "action-dechiffrer",
              render: (row) => (
                <button
                  className="button-classic"
                  onClick={() => {
                    console.log(row);
                    setItem(row);
                    setOpen(true);
                  }}
                >
                  Déchiffrer / Réparer
                </button>
              ),
            },
            {
              title: "Supprimer",
              dataKey: "action-supprimer",
              render: (item) => (
                <button
                  className="button-destructive"
                  onClick={() => {
                    if (!confirm("Êtes-vous sûr de vouloir supprimer DEFINITIVEMENT cette donnée ?")) return;
                    if (item.type === "person") {
                      // TODO
                    }
                  }}
                >
                  Supprimer
                </button>
              ),
            },
          ]}
        />
      </div>
      <ModalRepair open={open} setOpen={setOpen} item={item} />
    </div>
  );
}

function ModalRepair({ open, setOpen, item }) {
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
    await refresh();
    toast.success("L'élément a été remis à jour !");
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
