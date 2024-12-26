import { useState } from "react";
import { useHistory } from "react-router-dom";
import { Formik } from "formik";
import { toast } from "react-toastify";
import personIcon from "../../assets/icons/person-icon.svg";

import ButtonCustom from "../../components/ButtonCustom";
import { currentTeamState, userState } from "../../recoil/auth";
import { personsState, usePreparePersonForEncryption } from "../../recoil/persons";
import { useRecoilState, useRecoilValue } from "recoil";
import API, { tryFetchExpectOk } from "../../services/api";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";
import dayjs from "dayjs";
import { useDataLoader } from "../../services/dataLoader";
import { ModalBody, ModalContainer, ModalHeader } from "../../components/tailwind/Modal";

const CreatePerson = () => {
  const { refresh } = useDataLoader();
  const [open, setOpen] = useState(false);
  const currentTeam = useRecoilValue(currentTeamState);
  const user = useRecoilValue(userState);
  const history = useHistory();
  const [persons] = useRecoilState(personsState);
  const { encryptPerson } = usePreparePersonForEncryption();

  return (
    <>
      <ButtonCustom
        icon={personIcon}
        disabled={!currentTeam}
        onClick={() => setOpen(true)}
        color="primary"
        type="button"
        title="Créer une personne"
        padding="12px 24px"
      />
      <ModalContainer open={open} onClose={() => setOpen(false)} size="3xl">
        <ModalHeader title="Créer une nouvelle personne" onClose={() => setOpen(false)} />
        <ModalBody>
          <Formik
            initialValues={{ name: "", assignedTeams: [currentTeam?._id] }}
            onSubmit={async (body, actions) => {
              if (!body.name?.trim()?.length) return toast.error("Une personne doit avoir un nom");
              if (!body.assignedTeams?.length) return toast.error("Une personne doit être suivie par au moins une équipe");
              const existingPerson = persons.find((p) => p.name === body.name);
              if (existingPerson) return toast.error("Une personne existe déjà à ce nom");
              body.followedSince = dayjs();
              body.user = user._id;
              const [error, response] = await tryFetchExpectOk(async () =>
                API.post({
                  path: "/person",
                  body: await encryptPerson(body),
                })
              );
              if (!error) {
                await refresh();
                toast.success("Création réussie !");
                setOpen(false);
                actions.setSubmitting(false);
                history.push(`/person/${response.data._id}`);
              }
            }}
          >
            {({ values, handleChange, handleSubmit, isSubmitting }) => (
              <div className="tw-p-4">
                <div className="tw-grid tw-grid-cols-2 tw-gap-4">
                  <div>
                    <label htmlFor="name">Nom</label>
                    <input className="tailwindui" autoComplete="off" name="name" id="name" value={values.name} onChange={handleChange} />
                  </div>
                  <div>
                    <label htmlFor="person-select-assigned-team">Équipe(s) en charge</label>
                    <SelectTeamMultiple
                      onChange={(teamIds) => handleChange({ target: { value: teamIds, name: "assignedTeams" } })}
                      value={values.assignedTeams}
                      colored
                      inputId="person-select-assigned-team"
                      classNamePrefix="person-select-assigned-team"
                    />
                  </div>
                </div>
                <div className="tw-mt-4 tw-flex tw-justify-end">
                  <ButtonCustom
                    type="submit"
                    onClick={() => !isSubmitting && handleSubmit()}
                    disabled={!!isSubmitting || !values.name?.trim()?.length}
                    title={isSubmitting ? "Sauvegarde..." : "Sauvegarder"}
                  />
                </div>
              </div>
            )}
          </Formik>
        </ModalBody>
      </ModalContainer>
    </>
  );
};

export default CreatePerson;
