import { useState } from "react";
import API, { tryFetchExpectOk } from "../../services/api";
import { OrganisationInstance } from "../../types/organisation";
import { ModalContainer, ModalBody, ModalHeader, ModalFooter } from "../../components/tailwind/Modal";
import { toast } from "react-toastify";
import CitySelect from "../../components/CitySelect";
import SelectCustom from "../../components/SelectCustom";

export default function SuperadminOrganisationSettings({
  organisation,
  setOpen,
  open,
  updateOrganisation,
}: {
  organisation: OrganisationInstance;
  setOpen: (open: boolean) => void;
  open: boolean;
  updateOrganisation: (organisation: OrganisationInstance) => void;
}) {
  const [data, setData] = useState(organisation);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data.orgId) return toast.error("L'identifiant interne est obligatoire");
    if (!data.name) return toast.error("Le nom est obligatoire");
    if (!data.city) return toast.error("La ville est obligatoire");

    if (!(data.emailDirection || "").trim()) data.emailDirection = undefined;
    if (!(data.emailDpo || "").trim()) data.emailDpo = undefined;

    tryFetchExpectOk(() => API.put({ path: `/organisation/superadmin/${organisation._id}`, body: data })).then(([error, res]) => {
      if (!error) {
        toast.success("Organisation mise à jour");
        setOpen(false);
        updateOrganisation(res.data);
      } else {
        toast.error("Erreur lors de la mise à jour de l'organisation");
      }
    });
  }

  function onClose() {
    setOpen(false);
  }

  const options = [
    { value: "Guillaume", label: "Guillaume" },
    { value: "Melissa", label: "Melissa" },
    { value: "Yoann", label: "Yoann" },
    { value: "Simon", label: "Simon" },
    { value: undefined, label: "Non renseigné" },
  ];

  return (
    <ModalContainer open={open} onClose={onClose} size="3xl">
      <ModalHeader title={`Organisation ${organisation?.name}`} key={organisation?._id} onClose={onClose} />
      <ModalBody className="tw-px-4 tw-py-2">
        {data?._id && (
          <form id="organisation-settings" onSubmit={handleSubmit} className="-tw-mx-4 tw-flex tw-flex-row tw-flex-wrap">
            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <div className="tw-mb-4">
                <label htmlFor="name">Nom</label>
                <input
                  className="tailwindui"
                  autoComplete="off"
                  name="name"
                  id="name"
                  defaultValue={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                />
              </div>
            </div>
            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <div className="tw-mb-4">
                <label htmlFor="orgId" aria-disabled={true}>
                  Identifiant interne <small>(non modifiable par les users)</small>
                </label>
                <input
                  className="tailwindui"
                  autoComplete="off"
                  name="orgId"
                  id="orgId"
                  defaultValue={data.orgId}
                  onChange={(e) => setData({ ...data, orgId: e.target.value })}
                />
              </div>
            </div>

            <div className="tw-flex tw-basis-full tw-flex-col tw-px-4 tw-py-2">
              <div className="tw-mb-4">
                <label htmlFor="city">Ville</label>
                <CitySelect
                  name="city"
                  id="organisation-city"
                  value={{ city: data.city, region: data.region }}
                  onChange={(next) => {
                    setData({ ...data, city: next.city, region: next.region });
                  }}
                />
              </div>
            </div>
            <div className="tw-flex tw-basis-full tw-flex-col tw-px-4 tw-py-2">
              <div className="tw-mb-4">
                <label htmlFor="city">Responsable / Chargé de déploiement</label>
                <SelectCustom
                  name="responsible"
                  id="organisation-responsible"
                  value={options.find((option) => option.value === data.responsible)}
                  onChange={(nextResponsible) => {
                    setData({ ...data, responsible: nextResponsible.value });
                  }}
                  options={options}
                />
              </div>
            </div>

            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <div className="tw-mb-4">
                <label htmlFor="orgId" aria-disabled={true}>
                  Email Direction
                </label>
                <input
                  className="tailwindui"
                  autoComplete="off"
                  name="emailDirection"
                  id="emailDirection"
                  defaultValue={data.emailDirection}
                  onChange={(e) => setData({ ...data, emailDirection: e.target.value })}
                />
              </div>
            </div>
            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <div className="tw-mb-4">
                <label htmlFor="orgId" aria-disabled={true}>
                  Email DPO
                </label>
                <input
                  className="tailwindui"
                  autoComplete="off"
                  name="emailDpo"
                  id="emailDpo"
                  defaultValue={data.emailDpo}
                  onChange={(e) => setData({ ...data, emailDpo: e.target.value })}
                />
              </div>
            </div>
          </form>
        )}
      </ModalBody>
      <ModalFooter>
        <button className="button-cancel" onClick={onClose}>
          Fermer
        </button>
        <button form="organisation-settings" className="button-submit">
          Enregistrer
        </button>
      </ModalFooter>
    </ModalContainer>
  );
}
