import { useState, useCallback, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useDataLoader } from "../../services/dataLoader";
import { organisationState, teamsState } from "../../atoms/auth";
import API, { tryFetchExpectOk } from "../../services/api";
import { ModalContainer, ModalBody, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import { toast } from "react-toastify";
import { servicesSelector, flattenedServicesSelector } from "../../atoms/reports";
import DragAndDropSettings from "./DragAndDropSettings";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";

const ServicesSettings = () => {
  const [organisation, setOrganisation] = useAtom(organisationState);
  const groupedServices = useAtomValue(servicesSelector);
  const dataFormatted = useMemo(() => {
    return groupedServices.map(({ groupTitle, services }) => ({
      groupTitle,
      items: services || [],
    }));
  }, [groupedServices]);

  const { refresh } = useDataLoader();

  const persistGroupedServices = useCallback(
    async (newGroupedServices, { successMessage } = {}) => {
      const oldOrganisation = organisation;
      setOrganisation({ ...organisation, groupedServicesWithTeams: newGroupedServices }); // optimistic UI

      const [error, response] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/service/update-configuration`,
          body: { groupedServices: newGroupedServices },
        })
      );
      if (error) {
        setOrganisation(oldOrganisation);
        return false;
      }
      refresh();
      setOrganisation(response.data);
      if (successMessage) toast.success(successMessage);
      return true;
    },
    [organisation, refresh, setOrganisation]
  );

  const onAddGroup = async (groupTitle) => {
    await persistGroupedServices([...groupedServices, { groupTitle, services: [] }], {
      successMessage: "Groupe créé. Veuillez notifier vos équipes pour qu'elles rechargent leur app ou leur dashboard",
    });
  };

  const onGroupChange = async ({ oldName, newName }, teamChange) => {
    if (!newName) {
      toast.error("Vous devez saisir un nom pour le groupe");
      return;
    }
    const newGroupedServices = groupedServices.map((group) => {
      if (group.groupTitle !== oldName) return group;
      return {
        ...group,
        groupTitle: newName,
        services: !teamChange
          ? group.services
          : (group.services || []).map((service) => ({
              ...service,
              enabled: teamChange.enabled,
              enabledTeams: teamChange.enabled ? [] : teamChange.enabledTeams,
            })),
      };
    });
    await persistGroupedServices(newGroupedServices, {
      successMessage: "Groupe mis à jour. Veuillez notifier vos équipes pour qu'elles rechargent leur app ou leur dashboard",
    });
  };

  const onDeleteGroup = async (groupTitle) => {
    const newGroupedServices = groupedServices.filter((group) => group.groupTitle !== groupTitle);
    await persistGroupedServices(newGroupedServices, {
      successMessage: "Groupe supprimé. Veuillez notifier vos équipes pour qu'elles rechargent leur app ou leur dashboard",
    });
  };

  const flattenedServices = useAtomValue(flattenedServicesSelector);

  const onDragAndDrop = useCallback(
    async (newGroups) => {
      const rebuilt = newGroups.map((group) => ({
        groupTitle: group.groupTitle,
        // Le DnD ne nous renvoie que les noms (data-item) ; on retrouve les objets services complets
        // pour préserver enabled/enabledTeams. Si un service ne se retrouve pas (ne devrait pas
        // arriver), on le recrée avec les valeurs par défaut.
        services: group.items.map((name) => flattenedServices.find((s) => s.name === name) || { name, enabled: true, enabledTeams: [] }),
      }));

      const oldOrganisation = organisation;
      setOrganisation({ ...organisation, groupedServicesWithTeams: rebuilt }); // optimistic UI

      const [error, response] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/service/update-configuration`,
          body: { groupedServices: rebuilt },
        })
      );
      if (!error) {
        refresh();
        setOrganisation(response.data);
        toast.success("Le groupe a été déplacé.");
      } else {
        setOrganisation(oldOrganisation);
      }
    },
    [flattenedServices, organisation, refresh, setOrganisation]
  );

  return (
    <DragAndDropSettings
      title={<h3 className="tw-mb-0 tw-text-xl tw-font-extrabold">Services</h3>}
      data={dataFormatted}
      addButtonCaption="Ajouter un groupe"
      onAddGroup={onAddGroup}
      onGroupChange={onGroupChange}
      dataItemKey={(item) => (typeof item === "string" ? item : item.name)}
      ItemComponent={Service}
      NewItemComponent={AddService}
      onDeleteGroup={onDeleteGroup}
      onDragAndDrop={onDragAndDrop}
      canChangeTeamsVisibility
    />
  );
};

const AddService = ({ groupTitle }) => {
  const groupedServices = useAtomValue(servicesSelector);
  const flattenedServices = useAtomValue(flattenedServicesSelector);

  const [organisation, setOrganisation] = useAtom(organisationState);

  const onAddService = async (e) => {
    e.preventDefault();
    const { newService } = Object.fromEntries(new FormData(e.target));
    const trimmedNewService = newService?.trim();
    if (!trimmedNewService) return toast.error("Vous devez saisir un nom pour le service");
    if (flattenedServices.some((s) => s.name === trimmedNewService)) {
      const existingGroupTitle = groupedServices.find(({ services }) => services.some((s) => s.name === trimmedNewService))?.groupTitle;
      // eslint-disable-next-line no-irregular-whitespace
      return toast.error(`Ce service existe déjà : ${existingGroupTitle} > ${trimmedNewService}`);
    }
    const newGroupedServices = groupedServices.map((group) => {
      if (group.groupTitle !== groupTitle) return group;
      return {
        ...group,
        services: [...(group.services || []), { name: trimmedNewService, enabled: true, enabledTeams: [] }],
      };
    });

    const oldOrganisation = organisation;
    setOrganisation({ ...organisation, groupedServicesWithTeams: newGroupedServices }); // optimistic UI
    const [error, response] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/service/update-configuration`,
        body: { groupedServices: newGroupedServices },
      })
    );
    if (!error) {
      setOrganisation(response.data);
      e.target.reset();
      toast.success("Service ajouté. Veuillez notifier vos équipes pour qu'elles rechargent leur app ou leur dashboard");
    } else {
      setOrganisation(oldOrganisation);
    }
  };

  return (
    <form className="tw-mt-4 tw-flex" onSubmit={onAddService}>
      <input
        type="text"
        id="newService"
        name="newService"
        className="form-text tw-my-1 tw-w-full tw-rounded tw-bg-white/50 tw-px-1.5 tw-py-1 placeholder:tw-opacity-80"
        placeholder="Ajouter un service"
      />
      <button type="submit" className="tw-ml-4 tw-break-normal tw-rounded tw-bg-transparent hover:tw-underline">
        Ajouter
      </button>
    </form>
  );
};

const Service = ({ item: service, groupTitle }) => {
  const [isSelected, setIsSelected] = useState(false);
  const [isEditingService, setIsEditingService] = useState(false);
  const [organisation, setOrganisation] = useAtom(organisationState);
  const teams = useAtomValue(teamsState);

  const groupedServices = useAtomValue(servicesSelector);
  const flattenedServices = useAtomValue(flattenedServicesSelector);
  const { refresh } = useDataLoader();

  const [draftEnabled, setDraftEnabled] = useState(service.enabled);
  const [draftEnabledTeams, setDraftEnabledTeams] = useState(service.enabledTeams || []);
  const [draftName, setDraftName] = useState(service.name);

  const openEdit = () => {
    setDraftEnabled(service.enabled);
    setDraftEnabledTeams(service.enabledTeams || []);
    setDraftName(service.name);
    setIsEditingService(true);
  };

  const enabledTeamsLabel = useMemo(() => {
    if (service.enabled) return null;
    if (!service.enabledTeams?.length) return "Désactivé";
    const names = service.enabledTeams.map((id) => teams.find((t) => t._id === id)?.name).filter(Boolean);
    return `Visible par ${names.join(", ") || "—"}`;
  }, [service.enabled, service.enabledTeams, teams]);

  const onSaveService = async (e) => {
    e.preventDefault();
    const trimmedNewName = draftName?.trim();
    if (!trimmedNewName) return toast.error("Vous devez saisir un nom pour le service");

    const nameChanged = trimmedNewName !== service.name;
    if (nameChanged && flattenedServices.some((s) => s.name === trimmedNewName)) {
      const existingGroupTitle = groupedServices.find(({ services }) => services.some((s) => s.name === trimmedNewName))?.groupTitle;
      return toast.error(`Ce service existe déjà : ${existingGroupTitle} > ${trimmedNewName}`);
    }
    if (!draftEnabled && draftEnabledTeams.length === 0) {
      return toast.error("Sélectionnez au moins une équipe ou activez pour toute l'organisation");
    }

    const newGroupedServices = groupedServices.map((group) => {
      if (group.groupTitle !== groupTitle) return group;
      return {
        ...group,
        services: (group.services || []).map((s) =>
          s.name !== service.name
            ? s
            : {
                ...s,
                name: trimmedNewName,
                enabled: draftEnabled,
                enabledTeams: draftEnabled ? [] : draftEnabledTeams,
              }
        ),
      };
    });
    const oldOrganisation = organisation;
    setOrganisation({ ...organisation, groupedServicesWithTeams: newGroupedServices }); // optimistic UI

    const [error, response] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/service/update-configuration`,
        body: { groupedServices: newGroupedServices },
      })
    );
    if (!error) {
      if (nameChanged) {
        const [renameError] = await tryFetchExpectOk(async () =>
          API.put({
            path: `/service/update-service-name`,
            body: { oldService: service.name, newService: trimmedNewName },
          })
        );
        if (renameError) {
          toast.error("Erreur lors de la mise à jour du nom du service sur les anciens services");
        }
      }
      refresh();
      setOrganisation(response.data);
      setIsEditingService(false);
      toast.success("Service mis à jour. Veuillez notifier vos équipes pour qu'elles rechargent leur app ou leur dashboard");
    } else {
      setOrganisation(oldOrganisation);
    }
  };

  const onDeleteService = async () => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce service ? Cette opération est irréversible")) return;
    const newGroupedServices = groupedServices.map((group) => {
      if (group.groupTitle !== groupTitle) return group;
      return {
        ...group,
        services: (group.services || []).filter((s) => s.name !== service.name),
      };
    });

    const oldOrganisation = organisation;
    setOrganisation({ ...organisation, groupedServicesWithTeams: newGroupedServices }); // optimistic UI

    const [error, response] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/service/update-configuration`,
        body: { groupedServices: newGroupedServices },
      })
    );
    if (!error) {
      refresh();
      setIsEditingService(false);
      setOrganisation(response.data);
      toast.success("Service supprimé. Veuillez notifier vos équipes pour qu'elles rechargent leur app ou leur dashboard");
    } else {
      toast.error("Erreur lors de la suppression du service");
      setOrganisation(oldOrganisation);
    }
  };

  return (
    <>
      <div
        key={service.name}
        data-service={service.name}
        onMouseDown={() => setIsSelected(true)}
        onMouseUp={() => setIsSelected(false)}
        className={[
          "tw-group tw-flex tw-cursor-move tw-items-center tw-border-2 tw-border-transparent tw-pl-1",
          isSelected ? "tw-rounded tw-border-main" : "",
        ].join(" ")}
      >
        <div className="tw-m-0 tw-flex tw-flex-col" id={service.name}>
          <span>{service.name}</span>
          {enabledTeamsLabel && <span className="tw-text-xs tw-italic tw-text-gray-500">{enabledTeamsLabel}</span>}
        </div>
        <button
          type="button"
          aria-label={`Modifier le service ${service.name}`}
          className="tw-ml-auto tw-hidden group-hover:tw-inline-flex"
          onClick={openEdit}
        >
          ✏️
        </button>
      </div>
      <ModalContainer open={isEditingService}>
        <ModalHeader title={`Modifier le service : ${service.name}`} />
        <ModalBody className="tw-py-4">
          <form id="edit-service-form" className="tw-flex tw-w-full tw-flex-col tw-gap-4 tw-px-8" onSubmit={onSaveService}>
            <div>
              <label htmlFor="newService" className="tailwindui">
                Nom du service
              </label>
              <input
                className="tailwindui"
                autoComplete="off"
                id="newService"
                name="newService"
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="enabledTeams" className="tailwindui">
                Activé pour
              </label>
              <SelectTeamMultiple
                colored
                inputId="enabledTeams"
                classNamePrefix="enabledTeams"
                onChange={(teamIds) => setDraftEnabledTeams(teamIds)}
                value={draftEnabled ? [] : draftEnabledTeams}
                isDisabled={draftEnabled}
              />
              <div>
                <label className="tw-text-sm">
                  <input type="checkbox" className="tw-mr-2 tw-mt-2" checked={draftEnabled} onChange={(e) => setDraftEnabled(e.target.checked)} />
                  <span>Activé pour toute l'organisation</span>
                </label>
              </div>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <button type="button" name="cancel" className="button-cancel" onClick={() => setIsEditingService(false)}>
            Annuler
          </button>
          <button type="button" className="button-destructive" onClick={onDeleteService}>
            Supprimer
          </button>
          <button type="submit" className="button-submit" form="edit-service-form">
            Enregistrer
          </button>
        </ModalFooter>
      </ModalContainer>
    </>
  );
};

export default ServicesSettings;
