import { useState, useCallback, useMemo } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { useDataLoader } from "../../services/dataLoader";
import { organisationState } from "../../recoil/auth";
import API, { tryFetchExpectOk } from "../../services/api";
import { ModalContainer, ModalBody, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import { toast } from "react-toastify";
import { servicesSelector, flattenedServicesSelector } from "../../recoil/reports";
import DragAndDropSettings from "./DragAndDropSettings";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";

// Helper to get service name (handles both string and object format)
const getServiceName = (service) => {
  return typeof service === "string" ? service : service.name;
};

// Helper to get full service object
const getServiceObject = (service) => {
  if (typeof service === "string") {
    return { name: service, enabled: true, enabledTeams: [] };
  }
  return service;
};

const ServicesSettings = () => {
  const [organisation, setOrganisation] = useRecoilState(organisationState);
  const groupedServices = useRecoilValue(servicesSelector);
  const dataFormatted = useMemo(() => {
    return groupedServices.map(({ groupTitle, services }) => ({
      groupTitle,
      items: services.map(getServiceName),
    }));
  }, [groupedServices]);

  const { refresh } = useDataLoader();

  const onAddGroup = async (groupTitle) => {
    const oldOrganisation = organisation;
    setOrganisation({ ...organisation, groupedServices: [...groupedServices, { groupTitle, services: [] }] }); // optimistic UI

    const [error, response] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/service/update-configuration`,
        body: {
          groupedServices: [...groupedServices, { groupTitle, services: [] }],
        },
      })
    );
    if (!error) {
      refresh();
      setOrganisation(response.data);
      toast.success("Groupe créé. Veuillez notifier vos équipes pour qu'elles rechargent leur app ou leur dashboard");
    } else {
      setOrganisation(oldOrganisation);
    }
  };

  const onGroupTitleChange = async (oldGroupTitle, newGroupTitle) => {
    const newGroupedServices = groupedServices.map((group) => {
      if (group.groupTitle !== oldGroupTitle) return group;
      return {
        ...group,
        groupTitle: newGroupTitle,
      };
    });

    const oldOrganisation = organisation;
    setOrganisation({ ...organisation, groupedServices: newGroupedServices }); // optimistic UI

    const [error, response] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/service/update-configuration`,
        body: {
          groupedServices: newGroupedServices,
        },
      })
    );
    if (!error) {
      refresh();
      setOrganisation(response.data);
      toast.success("Groupe mis à jour. Veuillez notifier vos équipes pour qu'elles rechargent leur app ou leur dashboard");
    } else {
      setOrganisation(oldOrganisation);
    }
  };

  const onDeleteGroup = async (groupTitle) => {
    const newGroupedServices = groupedServices.filter((group) => group.groupTitle !== groupTitle);

    const oldOrganisation = organisation;
    setOrganisation({ ...organisation, groupedServices: newGroupedServices }); // optimistic UI

    // We don't delete the actual services to avoid user mistakes
    const [error, response] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/service/update-configuration`,
        body: {
          groupedServices: newGroupedServices,
        },
      })
    );
    if (!error) {
      refresh();
      setOrganisation(response.data);
      toast.success("Service supprimé. Veuillez notifier vos équipes pour qu'elles rechargent leur app ou leur dashboard");
    } else {
      setOrganisation(oldOrganisation);
    }
  };

  const onDragAndDrop = useCallback(
    async (newGroups) => {
      // Map the items (service names) back to their full service objects
      newGroups = newGroups.map((group) => {
        const services = group.items.map((serviceName) => {
          // Search for the service in ALL groups (in case it was moved between groups)
          let originalService = null;
          for (const g of groupedServices) {
            originalService = g.services?.find((s) => getServiceName(s) === serviceName);
            if (originalService) break;
          }
          return originalService || { name: serviceName, enabled: true, enabledTeams: [] };
        });
        return { groupTitle: group.groupTitle, services };
      });

      const oldOrganisation = organisation;
      setOrganisation({ ...organisation, groupedServices: newGroups }); // optimistic UI

      const [error, response] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/service/update-configuration`,
          body: {
            groupedServices: newGroups,
          },
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
    [refresh, setOrganisation, organisation, groupedServices]
  );

  return (
    <DragAndDropSettings
      title={<h3 className="tw-mb-0 tw-text-xl tw-font-extrabold">Services</h3>}
      data={dataFormatted}
      addButtonCaption="Ajouter un groupe"
      onAddGroup={onAddGroup}
      onGroupTitleChange={onGroupTitleChange}
      dataItemKey={(cat) => cat}
      ItemComponent={Service}
      NewItemComponent={AddService}
      onDeleteGroup={onDeleteGroup}
      onDragAndDrop={onDragAndDrop}
    />
  );
};

const AddService = ({ groupTitle }) => {
  const groupedServices = useRecoilValue(servicesSelector);
  // const reports = useRecoilValue(reportsState);
  const flattenedServices = useRecoilValue(flattenedServicesSelector);

  const [organisation, setOrganisation] = useRecoilState(organisationState);

  const onAddService = async (e) => {
    e.preventDefault();
    const { newService } = Object.fromEntries(new FormData(e.target));
    const trimmedNewService = newService?.trim();
    if (!trimmedNewService) return toast.error("Vous devez saisir un nom pour le service");
    if (flattenedServices.includes(trimmedNewService)) {
      const existingGroupTitle = groupedServices.find(({ services }) => services.some((s) => getServiceName(s) === trimmedNewService)).groupTitle;
      // eslint-disable-next-line no-irregular-whitespace
      return toast.error(`Ce service existe déjà : ${existingGroupTitle} > ${trimmedNewService}`);
    }
    const newServiceObject = { name: trimmedNewService, enabled: true, enabledTeams: [] };
    const newGroupedServices = groupedServices.map((group) => {
      if (group.groupTitle !== groupTitle) return group;
      return {
        ...group,
        services: [...(group.services || []), newServiceObject],
      };
    });

    const oldOrganisation = organisation;
    setOrganisation({ ...organisation, groupedServices: newGroupedServices }); // optimistic UI
    const [error, response] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/service/update-configuration`,
        body: {
          groupedServices: newGroupedServices,
        },
      })
    );
    if (!error) {
      setOrganisation(response.data);
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

const Service = ({ item: serviceName, groupTitle }) => {
  const [isSelected, setIsSelected] = useState(false);
  const [isEditingService, setIsEditingService] = useState(false);
  const [organisation, setOrganisation] = useRecoilState(organisationState);

  const groupedServices = useRecoilValue(servicesSelector);
  const flattenedServices = useRecoilValue(flattenedServicesSelector);
  const { refresh } = useDataLoader();

  // Get the full service object from the grouped services
  const serviceObject = useMemo(() => {
    const group = groupedServices.find((g) => g.groupTitle === groupTitle);
    const service = group?.services?.find((s) => getServiceName(s) === serviceName);
    return getServiceObject(service || serviceName);
  }, [groupedServices, groupTitle, serviceName]);

  const [editedService, setEditedService] = useState(serviceObject);

  // Update editedService when modal opens
  useMemo(() => {
    if (isEditingService) {
      setEditedService(serviceObject);
    }
  }, [isEditingService, serviceObject]);

  const onSaveService = async (e) => {
    e.preventDefault();
    const { newServiceName } = Object.fromEntries(new FormData(e.target));
    const oldServiceName = serviceName;
    const trimmedNewServiceName = newServiceName?.trim();
    if (!trimmedNewServiceName) return toast.error("Vous devez saisir un nom pour le service");
    if (
      trimmedNewServiceName === oldServiceName &&
      editedService.enabled === serviceObject.enabled &&
      JSON.stringify(editedService.enabledTeams) === JSON.stringify(serviceObject.enabledTeams)
    ) {
      return toast.error("Aucune modification n'a été effectuée");
    }
    if (trimmedNewServiceName !== oldServiceName && flattenedServices.includes(trimmedNewServiceName)) {
      const existingGroupTitle = groupedServices.find(({ services }) => services.some((s) => getServiceName(s) === trimmedNewServiceName)).groupTitle;
      return toast.error(`Ce service existe déjà: ${existingGroupTitle} > ${trimmedNewServiceName}`);
    }

    const newGroupedServices = groupedServices.map((group) => {
      if (group.groupTitle !== groupTitle) return group;
      return {
        ...group,
        services: group.services.map((s) => {
          const sName = getServiceName(s);
          if (sName !== oldServiceName) return s;
          return {
            name: trimmedNewServiceName,
            enabled: editedService.enabled,
            enabledTeams: editedService.enabledTeams || [],
          };
        }),
      };
    });

    const oldOrganisation = organisation;
    setOrganisation({ ...organisation, groupedServices: newGroupedServices }); // optimistic UI

    const [error, response] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/service/update-configuration`,
        body: {
          groupedServices: newGroupedServices,
        },
      })
    );
    if (!error) {
      if (trimmedNewServiceName !== oldServiceName) {
        const [error] = await tryFetchExpectOk(async () =>
          API.put({
            path: `/service/update-service-name`,
            body: { oldService: oldServiceName, newService: trimmedNewServiceName },
          })
        );

        if (error) {
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
        services: group.services.filter((s) => getServiceName(s) !== serviceName),
      };
    });

    const oldOrganisation = organisation;
    setOrganisation({ ...organisation, groupedServices: newGroupedServices }); // optimistic UI

    // We don't delete the actual services to avoid user mistakes
    const [error, response] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/service/update-configuration`,
        body: {
          groupedServices: newGroupedServices,
        },
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
        key={serviceName}
        data-service={serviceName}
        onMouseDown={() => setIsSelected(true)}
        onMouseUp={() => setIsSelected(false)}
        className={[
          "tw-group tw-flex tw-cursor-move tw-items-center tw-border-2 tw-border-transparent tw-pl-1",
          isSelected ? "tw-rounded tw-border-main" : "",
        ].join(" ")}
      >
        <p className="tw-m-0" id={serviceName}>
          {serviceName}
        </p>
        <button
          type="button"
          aria-label={`Modifier le service ${serviceName}`}
          className="tw-ml-auto tw-hidden group-hover:tw-inline-flex"
          onClick={() => setIsEditingService(true)}
        >
          ✏️
        </button>
      </div>
      <ModalContainer open={isEditingService} size="3xl">
        <ModalHeader title={`Modifier le service: ${serviceName}`} />
        <ModalBody className="tw-py-4">
          <form id="edit-service-form" className="tw-flex tw-w-full tw-flex-col tw-gap-4 tw-px-8" onSubmit={onSaveService}>
            <div>
              <label htmlFor="newServiceName" className="tailwindui">
                Nom du service
              </label>
              <input className="tailwindui" autoComplete="off" id="newServiceName" name="newServiceName" type="text" defaultValue={serviceName} />
            </div>
            <div>
              <label htmlFor="enabledTeams" className="tailwindui">
                Activé pour
              </label>
              <SelectTeamMultiple
                colored
                inputId="enabledTeams"
                classNamePrefix="enabledTeams"
                onChange={(teamIds) => setEditedService({ ...editedService, enabledTeams: teamIds })}
                value={editedService.enabled ? [] : editedService.enabledTeams ?? []}
                isDisabled={editedService.enabled}
              />
              <div className="tw-mt-2">
                <label className="tw-text-sm">
                  <input
                    type="checkbox"
                    className="tw-mr-2"
                    checked={editedService.enabled}
                    onChange={(e) => setEditedService({ ...editedService, enabled: e.target.checked })}
                  />
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
