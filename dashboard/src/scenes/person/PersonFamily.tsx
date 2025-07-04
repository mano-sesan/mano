import { useState, useMemo } from "react";
import { toast } from "react-toastify";
import { useRecoilState, useRecoilValue } from "recoil";
import { v4 as uuidv4 } from "uuid";
import ButtonCustom from "../../components/ButtonCustom";
import UserName from "../../components/UserName";
import { userState } from "../../recoil/auth";
import { dayjsInstance } from "../../services/date";
import API, { tryFetchExpectOk } from "../../services/api";
import { groupsState, encryptGroup } from "../../recoil/groups";
import SelectPerson from "../../components/SelectPerson";
import { useDataLoader } from "../../services/dataLoader";
import PersonName from "../../components/PersonName";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../../components/tailwind/Modal";
import { itemsGroupedByPersonSelector } from "../../recoil/selectors";
import type { PersonPopulated } from "../../types/person";
import type { Relation, GroupInstance } from "../../types/group";
import type { UUIDV4 } from "../../types/uuid";

interface PersonFamilyProps {
  person: PersonPopulated;
}

const PersonFamily = ({ person }: PersonFamilyProps) => {
  const [groups] = useRecoilState(groupsState);
  const user = useRecoilValue(userState);
  const itemsGroupedByPerson = useRecoilValue(itemsGroupedByPersonSelector);
  const [newRelationModalOpen, setNewRelationModalOpen] = useState(false);
  const [relationToEdit, setRelationToEdit] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingRelationId, setDeletingRelationId] = useState(null);
  const { refresh } = useDataLoader();

  const personGroup = useMemo(() => {
    return groups.find((group) => group?.persons?.includes?.(person?._id)) || ({ persons: [], relations: [] } as GroupInstance);
  }, [groups, person?._id]);

  const onAddFamilyLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    // eslint-disable-next-line prefer-const
    let { personId, description, ...otherNewRelations } = Object.fromEntries(new FormData(e.currentTarget));
    // If you need to ensure that personId and description are strings:
    personId = String(personId);
    description = String(description);

    if (!personId) {
      setIsSubmitting(false);
      return toast.error("Veuillez sélectionner une personne pour créer le lien familial");
    }
    if (person._id === personId) {
      setIsSubmitting(false);
      return toast.error("Le lien avec cette personne est vite vu : c'est elle !");
    }
    if (personGroup.persons?.find((_personId) => _personId === personId)) {
      setIsSubmitting(false);
      return toast.error("Il y a déjà un lien entre ces deux personnes");
    }
    const personDoesntBelongToAGroupYet = !personGroup?.persons?.length;
    const personAlreadyBelongToAGroup = !personDoesntBelongToAGroupYet;
    const otherPersonAlreadyBelongToAGroup = groups.find((group) => group.persons?.find((_personId) => _personId === personId));
    if (personAlreadyBelongToAGroup && otherPersonAlreadyBelongToAGroup) {
      setIsSubmitting(false);
      return toast.error(
        "Cette personne fait déjà partie d'une autre famille.\nVous ne pouvez pour l'instant pas ajouter une personne à plusieurs familles.\nN'hésitez pas à nous contacter si vous souhaitez faire évoluer cette fonctionnalité."
      );
    }
    const groupToEdit = otherPersonAlreadyBelongToAGroup ?? personGroup;
    const nextRelations = [
      {
        _id: uuidv4(),
        persons: [person._id, personId],
        description,
        createdAt: dayjsInstance().toDate(),
        updatedAt: dayjsInstance().toDate(),
        user: user._id,
      },
    ];
    for (const otherNewRelation of Object.keys(otherNewRelations) || []) {
      const otherPersonId = otherNewRelation.replace("description-", "") as UUIDV4;
      const description = otherNewRelations[otherNewRelation] as string;
      if (person._id === otherPersonId) {
        continue;
      }
      nextRelations.push({
        _id: uuidv4(),
        persons: [person._id, otherPersonId],
        description,
        createdAt: dayjsInstance().toDate(),
        updatedAt: dayjsInstance().toDate(),
        user: user._id,
      });
    }

    const nextGroup = {
      ...groupToEdit,
      persons: [...new Set([...groupToEdit.persons, person._id, personId])],
      relations: [...groupToEdit.relations, ...nextRelations],
    };
    const isNew = !groupToEdit?._id;
    const [error] = await tryFetchExpectOk(async () =>
      isNew
        ? API.post({ path: "/group", body: await encryptGroup(nextGroup) })
        : API.put({ path: `/group/${groupToEdit._id}`, body: await encryptGroup(nextGroup) })
    );
    if (!error) {
      setNewRelationModalOpen(false);
      toast.success("Le lien familial a été ajouté");
      await refresh();
    }
    setIsSubmitting(false);
  };

  const onEditRelation = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    let { _id, description } = Object.fromEntries(new FormData(e.target));
    _id = String(_id);
    description = String(description);

    const nextGroup = {
      ...personGroup,
      relations: personGroup.relations.map((relation) =>
        relation._id === _id ? { ...relation, description, updatedAt: dayjsInstance().toDate(), user: user._id } : relation
      ),
    };
    const [error] = await tryFetchExpectOk(async () => API.put({ path: `/group/${personGroup._id}`, body: await encryptGroup(nextGroup) }));
    if (!error) {
      await refresh();
      setRelationToEdit(null);
      toast.success("Le lien familial a été modifié");
    }
    setIsSubmitting(false);
  };

  const onDeleteRelation = async (relation: Relation) => {
    setDeletingRelationId(relation._id);

    const personId1 = relation?.persons[0];
    const personId1Name = itemsGroupedByPerson[personId1]?.name;
    const personId2 = relation?.persons[1];
    const personId2Name = itemsGroupedByPerson[personId2]?.name;
    if (
      !window.confirm(
        `Voulez-vous vraiment supprimer le lien familial entre ${personId1Name} et ${personId2Name} ? Cette opération est irréversible.`
      )
    ) {
      setDeletingRelationId(null);
      return;
    }
    const nextRelations = personGroup.relations.filter((_relation) => _relation._id !== relation._id);
    if (!nextRelations.length) {
      const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/group/${personGroup._id}` }));
      if (!error) {
        await refresh();
        setRelationToEdit(null);
        toast.success("Le lien familial a été supprimé");
        setDeletingRelationId(null);
        return;
      }
    }
    const nextGroup = {
      persons: [...new Set(nextRelations.reduce((_personIds, relation) => [..._personIds, ...relation.persons], []))],
      relations: nextRelations,
    };
    const [error] = await tryFetchExpectOk(async () => API.put({ path: `/group/${personGroup._id}`, body: await encryptGroup(nextGroup) }));
    if (!error) {
      await refresh();
      setRelationToEdit(null);
      toast.success("Le lien familial a été supprimé");
    }
    setDeletingRelationId(null);
  };

  return (
    <>
      <div className="tw-my-10 tw-flex tw-items-center tw-gap-2">
        <h3 className="tw-mb-0 tw-text-xl tw-font-extrabold">Liens familiaux</h3>
        <ButtonCustom
          title="Ajouter un lien"
          type="button"
          className="tw-ml-auto"
          onClick={() => {
            refresh(); // just refresh to make sure we have the latest data
            setNewRelationModalOpen(true);
          }}
        />
        <NewRelation
          open={newRelationModalOpen}
          setOpen={setNewRelationModalOpen}
          onAddFamilyLink={onAddFamilyLink}
          person={person}
          isSubmitting={isSubmitting}
        />
      </div>
      {!personGroup.persons.length ? (
        <div className="tw-py-10 tw-text-center tw-text-gray-300">
          <p className="tw-text-lg tw-font-bold">Cette personne n'a pas encore de lien familial</p>
          <p className="tw-mt-2 tw-text-sm">
            Pour ajouter un lien familial, cliquez sur le bouton <span className="tw-font-bold">Ajouter un lien</span> ci-dessus.
          </p>
        </div>
      ) : (
        <table className="table table-striped table-bordered">
          <thead>
            <tr>
              <th>Lien entre</th>
              <th>Relation</th>
              <th>Enregistré par</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="small">
            {personGroup.relations.map((_relation) => {
              const { description, persons, createdAt, user } = _relation;
              return (
                <tr key={JSON.stringify(persons)}>
                  <td>
                    <PersonName item={{ person: persons[0] }} />
                    {" et "}
                    <PersonName item={{ person: persons[1] }} />
                  </td>
                  <td>{description}</td>
                  <td width="15%">
                    <UserName id={user} />
                  </td>
                  <td width="15%">{dayjsInstance(createdAt).format("DD/MM/YYYY HH:mm")}</td>
                  <td width="15%">
                    <div className="tw-flex tw-flex-col tw-items-center tw-gap-2">
                      <button
                        type="button"
                        className="button-classic"
                        onClick={() => setRelationToEdit(_relation)}
                        disabled={isSubmitting || deletingRelationId === _relation._id}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="button-destructive"
                        onClick={() => onDeleteRelation(_relation)}
                        disabled={isSubmitting || deletingRelationId === _relation._id}
                      >
                        {deletingRelationId === _relation._id ? "Suppression..." : "Supprimer"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <EditRelation
            open={!!relationToEdit}
            setOpen={setRelationToEdit}
            onEditRelation={onEditRelation}
            onDeleteRelation={onDeleteRelation}
            relationToEdit={relationToEdit}
            isSubmitting={isSubmitting}
            deletingRelationId={deletingRelationId}
          />
        </table>
      )}
    </>
  );
};

const NewRelation = ({ open, setOpen, onAddFamilyLink, person, isSubmitting }) => {
  const [newPersonId, setNewPersonId] = useState(null);
  const persons = useRecoilValue(itemsGroupedByPersonSelector);
  const newRelationExistingGroup = persons[newPersonId]?.group as GroupInstance;
  const personExistingGroup = persons[person._id]?.group as GroupInstance;

  const existingFamilyOfNewRelation = newRelationExistingGroup?.persons
    ?.filter((personId) => personId !== newPersonId)
    ?.filter((personId) => personId !== person?._id)
    ?.filter((personId) => !personExistingGroup?.persons?.includes(personId));

  const isSamePerson = newPersonId === person._id;

  const alreadyExistingNewRelation =
    !isSamePerson && newRelationExistingGroup?.persons?.filter((personId) => personId === person?._id)?.length
      ? newRelationExistingGroup.relations.find((rel) => rel.persons?.includes(newPersonId) && rel.persons?.includes(person._id))
      : null;

  return (
    <ModalContainer open={open} size="3xl" onAfterLeave={() => setNewPersonId(null)}>
      <ModalHeader
        title={
          newRelationExistingGroup?.persons?.length > 0
            ? `Nouveaux liens familiaux entre ${person.name} et...`
            : `Nouveau lien familial entre ${person.name} et...`
        }
        onClose={() => setOpen(false)}
      />
      <ModalBody>
        <form id="new-family-relation" className="tw-flex tw-w-full tw-flex-col tw-gap-4 tw-px-8 tw-pb-2" onSubmit={onAddFamilyLink}>
          <div className="tw-flex tw-w-full tw-flex-wrap">
            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <label htmlFor="personId" className="form-text tailwindui">
                Personne suivie
              </label>
              <SelectPerson
                name="personId"
                noLabel
                disableAccessToPerson
                inputId="person-family-relation"
                value={newPersonId}
                onChange={(e) => setNewPersonId(e.currentTarget.value)}
              />
            </div>
            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <label htmlFor="description" className="form-text tailwindui">
                Relation/commentaire
              </label>
              <input
                className="form-text tailwindui"
                id="description"
                name="description"
                type="text"
                placeholder="Père/fille, mère/fils..."
                required
              />
            </div>
          </div>
          {newPersonId && isSamePerson && (
            <>
              <hr />
              <p className="tw-text-gray-500 tw-text-sm tw-px-8 tw-m-0 tw-mt-2">
                Un lien entre <span className="tw-font-bold">{persons[newPersonId]?.name}</span> et{" "}
                <span className="tw-font-bold">{person.name}</span> ? 🧐
              </p>
              <blockquote className="tw-text-gray-500 tw-text-sm tw-ml-8 tw-font-extrabold tw-border-l-2 tw-border-l-gray-200 tw-pl-4 tw-py-4 tw-my-4">
                Si ce n'est moi c'est donc mon frère 👯
              </blockquote>
            </>
          )}
          {newPersonId && alreadyExistingNewRelation && (
            <>
              <hr />
              <p className="tw-text-gray-500 tw-text-sm tw-px-8 tw-m-0 tw-mt-2">
                <span className="tw-font-bold">{persons[newPersonId]?.name}</span> a déjà déjà un lien familial avec{" "}
                <span className="tw-font-bold">{person.name}</span>:
              </p>
              <blockquote className="tw-text-gray-500 tw-text-sm tw-ml-8 tw-font-extrabold tw-border-l-2 tw-border-l-gray-200 tw-pl-4 tw-py-4 tw-my-4">
                {alreadyExistingNewRelation?.description}
              </blockquote>
              <p className="tw-text-gray-500 tw-text-sm tw-px-8 tw-m-0 tw-mt-2">
                Vous pouvez fermer cette fenêter et le modifier directement depuis la liste.
              </p>
            </>
          )}
          {newPersonId && !alreadyExistingNewRelation && !!existingFamilyOfNewRelation?.length && (
            <>
              <hr />
              <p className="tw-text-gray-500 tw-text-sm tw-px-8 tw-m-0 tw-mt-2">
                <span className="tw-font-bold">{persons[newPersonId]?.name}</span> a déjà des liens familiaux avec d'autres personnes, veuillez aussi
                renseigner ces relations avec <span className="tw-font-bold">{person.name}</span>
              </p>
              {existingFamilyOfNewRelation?.map((personId) => {
                return (
                  <div key={personId} className="tw-flex tw-w-full tw-flex-wrap">
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <label htmlFor="personId" className="form-text tailwindui">
                        Personne suivie
                      </label>
                      <div className="tailwindui">
                        <PersonName item={{ person: personId }} />
                      </div>
                    </div>
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <label htmlFor="description" className="form-text tailwindui">
                        Relation/commentaire
                      </label>
                      <input
                        className="form-text tailwindui"
                        id="description"
                        name={`description-${personId}`}
                        required
                        type="text"
                        placeholder="Père/fille, mère/fils..."
                      />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </form>
      </ModalBody>
      <ModalFooter>
        <button type="button" name="cancel" className="button-cancel" onClick={() => setOpen(false)} disabled={isSubmitting}>
          Annuler
        </button>
        <button type="submit" className="button-submit" form="new-family-relation" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </button>
      </ModalFooter>
    </ModalContainer>
  );
};

const EditRelation = ({ open, setOpen, onEditRelation, onDeleteRelation, relationToEdit, isSubmitting, deletingRelationId }) => {
  const itemsGroupedByPerson = useRecoilValue(itemsGroupedByPersonSelector);

  const personId1 = relationToEdit?.persons[0];
  const personId2 = relationToEdit?.persons[1];
  const personId1Name = itemsGroupedByPerson[personId1]?.name;
  const personId2Name = itemsGroupedByPerson[personId2]?.name;
  return (
    <ModalContainer open={open}>
      <ModalHeader title={`Éditer le lien familial entre ${personId1Name} et ${personId2Name}`} />
      <ModalBody>
        <form
          key={JSON.stringify(relationToEdit)}
          id="edit-family-relation"
          className="tw-flex tw-w-full tw-flex-col tw-gap-4 tw-px-8 tw-py-4"
          onSubmit={onEditRelation}
        >
          <input type="hidden" name="_id" defaultValue={relationToEdit?._id} />
          <input type="hidden" name="personId1" defaultValue={relationToEdit?.persons[0]} />
          <input type="hidden" name="personId2" defaultValue={relationToEdit?.persons[1]} />
          <div>
            <label htmlFor="description" className="form-text tailwindui">
              Relation/commentaire
            </label>
            <input
              className="form-text tailwindui"
              id="description"
              name="description"
              type="text"
              placeholder="Père/fille, mère/fils..."
              defaultValue={relationToEdit?.description}
            />
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          name="cancel"
          className="button-cancel"
          onClick={() => setOpen(null)}
          disabled={isSubmitting || deletingRelationId === relationToEdit?._id}
        >
          Annuler
        </button>
        <button
          type="button"
          className="button-destructive"
          onClick={() => onDeleteRelation(relationToEdit)}
          disabled={isSubmitting || deletingRelationId === relationToEdit?._id}
        >
          {deletingRelationId === relationToEdit?._id ? "Suppression..." : "Supprimer"}
        </button>
        <button
          type="submit"
          className="button-submit"
          form="edit-family-relation"
          disabled={isSubmitting || deletingRelationId === relationToEdit?._id}
        >
          {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </button>
      </ModalFooter>
    </ModalContainer>
  );
};

export default PersonFamily;
