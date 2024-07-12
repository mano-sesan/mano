import API, { tryFetchExpectOk } from "../../services/api";
import { decrypt, getHashedOrgEncryptionKey } from "../../services/encryption";
import { useRecoilValue } from "recoil";
import { organisationState } from "../../recoil/auth";
import { useEffect, useState } from "react";
import Loading from "../../components/loading";
import Table from "../../components/table";

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
      console.error(error);
      return [];
    }
    if (!res.hasMore) finished = true;
    const decryptedData = (await Promise.all(res.data.map((p) => getErroredDecryption(p)))).filter((e) => e);
    erroredPersons.push(...decryptedData.map((p) => ({ _id: p._id, type: "person" })));
  }
  return erroredPersons;
}

export default function Errors() {
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
          columns={[
            { title: "_id", dataKey: "_id" },
            { title: "Type", dataKey: "type" },
          ]}
        />
      </div>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="tw-mb-8 tw-border-l-4 tw-border-orange-500 tw-bg-orange-100 tw-p-4 tw-text-orange-700" role="alert">
      Blabla données indéchiffrables
    </div>
  );
}
