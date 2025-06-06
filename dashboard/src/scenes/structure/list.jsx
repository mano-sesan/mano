import { useEffect, useMemo, useState } from "react";
import Loading from "../../components/loading";
import Table from "../../components/table";
import { toast } from "react-toastify";
import ButtonCustom from "../../components/ButtonCustom";
import Search from "../../components/search";
import API, { tryFetch, tryFetchExpectOk } from "../../services/api";
import { formatDateWithFullMonth } from "../../services/date";
import useTitle from "../../services/useTitle";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import SelectCustom from "../../components/SelectCustom";
import { useRecoilValue } from "recoil";
import { userState } from "../../recoil/auth";
import { flattenedStructuresCategoriesSelector, sortStructures } from "../../recoil/structures";
import { filterBySearch } from "../search/utils";
import { errorMessage } from "../../utils";
import { useLocalStorage } from "../../services/useLocalStorage";

const List = () => {
  const user = useRecoilValue(userState);
  const [structures, setStructures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useLocalStorage("structures-sortBy", "dueAt");
  const [sortOrder, setSortOrder] = useLocalStorage("structures-sortOrder", "ASC");

  const [search, setSearch] = useState("");
  const [currentStructure, setCurrentStructure] = useState(null);
  const [currentStructureOpen, setCurrentStructureOpen] = useState(false);

  const filteredStructures = useMemo(() => {
    const orderedStructures = [...structures].sort(sortStructures(sortBy, sortOrder));
    if (!search) return orderedStructures;
    return filterBySearch(search, orderedStructures);
  }, [search, sortBy, sortOrder, structures]);

  useTitle("Contacts");

  const getStructures = async () => {
    const [error, response] = await tryFetchExpectOk(async () => API.get({ path: "/structure" }));
    if (error) {
      toast.error(errorMessage(error));
      return setIsLoading(false);
    }
    setStructures(response.data);
    setIsLoading(false);
  };

  useEffect(() => {
    getStructures();
  }, []);

  if (isLoading) return <Loading />;

  return (
    <>
      <div className="tw-flex tw-w-full tw-items-center tw-mt-8 tw-mb-12">
        <div className="tw-grow tw-text-xl">{`Contacts (${filteredStructures?.length})`}</div>
        {["admin", "normal"].includes(user.role) && (
          <div>
            <Structure
              key={currentStructure}
              structure={currentStructure}
              open={currentStructureOpen}
              onOpen={() => setCurrentStructureOpen(true)}
              onClose={() => {
                setCurrentStructureOpen(false);
                getStructures();
              }}
              onAfterLeave={() => setCurrentStructure(null)}
            />
          </div>
        )}
      </div>
      <div className="tw-mb-10 tw-flex tw-flex-wrap tw-border-b tw-border-gray-200">
        <div className="tw-mb-5 tw-flex tw-w-full tw-items-center tw-px-2">
          <label htmlFor="search" className="tw-mr-5 tw-w-40 tw-shrink-0">
            Recherche&nbsp;:
          </label>
          <Search placeholder="Nom, catégorie, ville, etc." value={search} onChange={setSearch} />
        </div>
      </div>
      <Table
        data={filteredStructures}
        rowKey={"_id"}
        onRowClick={(s) => {
          setCurrentStructure(s);
          setCurrentStructureOpen(true);
        }}
        columns={[
          {
            title: "Nom",
            dataKey: "name",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            render: (structure) => {
              return (
                <div className="[overflow-wrap:anywhere] tw-min-w-32">
                  <b>{structure.name}</b>
                </div>
              );
            },
          },
          {
            title: "Description",
            dataKey: "description",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            render: (structure) => <div className="[overflow-wrap:anywhere] tw-text-xs">{structure.description}</div>,
          },
          { title: "Téléphone", dataKey: "phone", onSortOrder: setSortOrder, onSortBy: setSortBy, sortBy, sortOrder },
          {
            title: "Adresse",
            dataKey: "adresse",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            render: (structure) => {
              return (
                <>
                  <div className="[overflow-wrap:anywhere]">{structure.adresse}</div>
                  {structure.postcode ? <div>{structure.postcode}</div> : null}
                  {structure.city ? <div>{structure.city}</div> : null}
                </>
              );
            },
          },
          {
            title: "Catégories",
            dataKey: "categories",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            render: (structure) => {
              return (
                <>
                  {structure.categories?.map((category) => (
                    <span
                      className="tw-whitespace-no-wrap tw-mx-0.5 tw-my-0 tw-inline-block tw-rounded tw-bg-main75 tw-px-1 tw-py-0.5 tw-text-center tw-align-baseline tw-text-[10.5px] tw-font-bold tw-leading-none tw-text-white"
                      color="info"
                      key={category}
                      data-test-id={structure.name + category}
                    >
                      {category}
                    </span>
                  ))}
                </>
              );
            },
          },
          {
            title: "Créée le",
            dataKey: "createdAt",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            render: (i) => formatDateWithFullMonth(i.createdAt),
          },
        ]}
      />
    </>
  );
};

const Structure = ({ structure: initStructure, open, onClose, onOpen, onAfterLeave }) => {
  const user = useRecoilValue(userState);
  const categories = useRecoilValue(flattenedStructuresCategoriesSelector);

  const [structure, setStructure] = useState(initStructure);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const onChange = (e) => setStructure({ ...structure, [e.target.name]: e.target.value });
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!structure.name) {
      toast.error("Le nom du contact est obligatoire");
      return;
    }
    setIsSubmitting(true);
    const isNew = !initStructure?._id;
    const [error] = await tryFetch(async () =>
      !isNew ? API.put({ path: `/structure/${initStructure._id}`, body: structure }) : API.post({ path: "/structure", body: structure })
    );
    if (error) {
      toast.error(errorMessage(error));
      setIsSubmitting(false);
      return;
    }
    toast.success(!isNew ? "Contact mis à jour !" : "Contact créé !");
    onClose();
  };

  const onDeleteStructure = async () => {
    if (window.confirm("Voulez-vous vraiment supprimer ce contact ? Cette action est irréversible.")) {
      setIsDeleting(true);
      const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/structure/${structure._id}` }));
      if (error) {
        toast.error(errorMessage(error));
        setIsDeleting(false);
        return;
      }
      toast.success("Contact supprimé !");
      setStructure(initStructure);
      onClose();
    }
  };

  return (
    <div className="tw-flex tw-w-full tw-justify-end">
      <ButtonCustom type="button" onClick={onOpen} color="primary" title="Créer un contact" padding="12px 24px" />
      <ModalContainer
        open={open}
        onClose={() => {
          setStructure(initStructure);
          onClose();
        }}
        size="full"
        onAfterLeave={() => {
          setStructure(null);
          setIsSubmitting(false);
          setIsDeleting(false);
          onAfterLeave();
        }}
      >
        <ModalHeader title={!initStructure?._id ? "Créer un contact" : "Modifier un contact"} />
        <ModalBody className="tw-pb-4">
          <form id="create-structure-form" className="tw-flex tw-w-full tw-flex-row tw-flex-wrap" onSubmit={onSubmit}>
            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <label className="tailwindui" htmlFor="name">
                Nom
              </label>
              <input type="text" className="tailwindui" autoComplete="off" name="name" id="name" value={structure?.name || ""} onChange={onChange} />
            </div>
            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <label className="tailwindui" htmlFor="phone">
                Téléphone
              </label>
              <input
                type="text"
                className="tailwindui"
                autoComplete="off"
                name="phone"
                id="phone"
                value={structure?.phone || ""}
                onChange={onChange}
              />
            </div>
            <div className="tw-flex tw-basis-full tw-flex-col tw-px-4 tw-py-2">
              <label className="tailwindui" htmlFor="adresse">
                Adresse (numéro et rue)
              </label>
              <textarea type="text" className="tailwindui" name="adresse" id="adresse" value={structure?.adresse || ""} onChange={onChange} />
            </div>
            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <label className="tailwindui" htmlFor="postcode">
                Code postal
              </label>
              <input type="text" className="tailwindui" name="postcode" id="postcode" value={structure?.postcode || ""} onChange={onChange} />
            </div>
            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <label className="tailwindui" htmlFor="city">
                Ville
              </label>
              <input type="text" className="tailwindui" autoComplete="off" name="city" id="city" value={structure?.city || ""} onChange={onChange} />
            </div>
            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <label className="tailwindui" htmlFor="description">
                Description
              </label>
              <textarea className="tailwindui" name="description" id="description" value={structure?.description || ""} onChange={onChange} />
            </div>
            <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
              <label className="tailwindui" htmlFor="description">
                Catégorie(s)
              </label>
              <SelectCustom
                inputId="categories"
                name="categories"
                classNamePrefix="categories"
                isMulti
                options={categories.map((opt) => ({ value: opt, label: opt }))}
                value={(structure?.categories || []).map((opt) => ({ value: opt, label: opt }))}
                onChange={(v) => {
                  onChange({ target: { name: "categories", value: v.map((v) => v.value) } });
                }}
              />
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <button type="button" name="cancel" className="button-cancel" onClick={onClose}>
            Annuler
          </button>
          {user.role === "admin" && Boolean(initStructure?._id) && (
            <button type="button" disabled={isSubmitting || isDeleting} className="button-destructive" onClick={onDeleteStructure}>
              {isDeleting ? "Suppression..." : "Supprimer"}
            </button>
          )}
          <button type="submit" disabled={isSubmitting || isDeleting} className="button-submit" form="create-structure-form">
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </button>
        </ModalFooter>
      </ModalContainer>
    </div>
  );
};

export default List;
